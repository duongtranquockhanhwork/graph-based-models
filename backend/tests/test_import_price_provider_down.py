"""Nhập CSV phải phân tích xong MỌI bài, kể cả khi bảng giá (vnstock) hỏng.

Lỗi đã xảy ra thật: nhập 22 bài, chỉ 6 bài được phân tích. Sau mỗi bài, việc tự
thêm mã vào watchlist gọi vnstock để kiểm mã có tồn tại; tới yêu cầu thứ 21
trong một phút vnai ném RateLimitExceeded (trên console cp1252 thì là
UnicodeEncodeError khi nó in cảnh báo), ngoại lệ thoát khỏi tác vụ nền và các bài
còn lại trong hàng không bao giờ chạy.
"""

import sys
import types

import pytest

from tests.conftest import auth


class RateLimitExceeded(Exception):
    """Cùng tên với vnai.beam.quota.RateLimitExceeded."""


FAILURES = {
    "rate_limit": lambda: RateLimitExceeded("Tối đa 20 yêu cầu/phút"),
    "unicode_print": lambda: UnicodeEncodeError("charmap", "⚠", 0, 1, "character maps to <undefined>"),
    "sys_exit": lambda: SystemExit("Rate limit exceeded. Process terminated."),
}

ARTICLES = [
    ("Cổ phiếu FPT tăng mạnh sau kết quả kinh doanh", "Cổ phiếu FPT tăng trần."),
    ("Cổ phiếu VNM báo lãi tăng 21%", "Vinamilk báo lãi tăng."),
    ("Cổ phiếu HPG giảm sâu", "Giá thép giảm, cổ phiếu HPG giảm."),
    ("Cổ phiếu VCB tăng trưởng tín dụng", "Ngân hàng VCB tăng trưởng."),
    ("Cổ phiếu MWG mở rộng chuỗi", "MWG mở thêm cửa hàng."),
    ("Cổ phiếu SSI lãi quý tăng", "Chứng khoán SSI báo lãi."),
    ("Cổ phiếu VIC ký hợp đồng mới", "Tập đoàn VIC ký kết hợp đồng mới."),
    ("Cổ phiếu MSN chia cổ tức", "MSN chia cổ tức tiền mặt."),
]
SYMBOLS = ["FPT", "VNM", "HPG", "VCB", "MWG", "SSI", "VIC", "MSN"]


def _csv() -> str:
    lines = ["title,content"]
    lines += [f'"{title}","{content}"' for title, content in ARTICLES]
    return "\n".join(lines)


def _install_price_board(monkeypatch, failure):
    """Thay vnstock bằng một bảng giá luôn hỏng, và đếm số lần bị gọi."""
    from app.services import live_price_service

    calls = []

    class Trading:
        def __init__(self, source):
            pass

        def price_board(self, symbols_list):
            calls.append(list(symbols_list))
            raise failure()

    monkeypatch.setitem(sys.modules, "vnstock", types.SimpleNamespace(Trading=Trading))
    monkeypatch.setattr(live_price_service, "_cache", {})
    return calls


def _user_id(email="test1@finnexus.dev"):
    from app.core.database import SessionLocal
    from app.models.user import User

    with SessionLocal() as db:
        return db.query(User).filter(User.email == email).one().id


def _clear_watchlist(user_id):
    from app.core.database import SessionLocal
    from app.models.watchlist import WatchlistItem

    with SessionLocal() as db:
        db.query(WatchlistItem).filter(
            WatchlistItem.user_id == user_id, WatchlistItem.symbol.in_(SYMBOLS)
        ).delete(synchronize_session=False)
        db.commit()


def _watchlist(user_id):
    from app.core.database import SessionLocal
    from app.models.watchlist import WatchlistItem

    with SessionLocal() as db:
        return {i.symbol for i in db.query(WatchlistItem).filter(WatchlistItem.user_id == user_id)}


def _upload(client, token):
    r = client.post(
        "/api/news/upload-csv",
        headers=auth(token),
        files={"file": ("batch.csv", _csv().encode("utf-8"), "text/csv")},
    )
    assert r.status_code == 200, r.text
    ids = r.json()["ids"]
    assert len(ids) == len(ARTICLES)
    return ids


def _analyzed_flags(ids):
    from app.core.database import SessionLocal
    from app.models.news import NewsArticle

    with SessionLocal() as db:
        rows = db.query(NewsArticle).filter(NewsArticle.id.in_(ids)).all()
        return {n.id: n.is_analyzed for n in rows}


@pytest.mark.parametrize("failure", list(FAILURES), ids=list(FAILURES))
def test_every_article_is_analyzed_when_the_price_board_fails(client, user_token, monkeypatch, failure):
    from app.services import watchlist_service

    calls = _install_price_board(monkeypatch, FAILURES[failure])
    # Bỏ lối tắt từ điển để mọi mã đều phải đi qua bảng giá đang hỏng.
    monkeypatch.setattr(watchlist_service, "STOCK_DICT", {})
    user_id = _user_id()
    _clear_watchlist(user_id)

    ids = _upload(client, user_token)

    assert calls, "bảng giá phải thực sự bị gọi, nếu không test này không chứng minh gì"
    assert _analyzed_flags(ids) == {i: True for i in ids}
    # Không kiểm được mã thì không thêm — không đoán bừa.
    assert not _watchlist(user_id) & set(SYMBOLS)


def test_dictionary_symbols_are_added_without_calling_the_price_board(client, user_token, monkeypatch):
    calls = _install_price_board(monkeypatch, FAILURES["rate_limit"])
    user_id = _user_id()
    _clear_watchlist(user_id)

    ids = _upload(client, user_token)

    assert calls == []
    assert _analyzed_flags(ids) == {i: True for i in ids}
    assert set(SYMBOLS) <= _watchlist(user_id)


def test_an_unexpected_watchlist_error_does_not_stop_the_batch(client, user_token, monkeypatch):
    """Lớp chặn cuối trong _run_analysis, phòng lỗi không đến từ bảng giá."""
    from app.services import watchlist_service

    def explode(db, user_id, symbol):
        raise SystemExit("vnai quota")

    monkeypatch.setattr(watchlist_service, "add_symbol", explode)

    ids = _upload(client, user_token)

    assert _analyzed_flags(ids) == {i: True for i in ids}


@pytest.mark.parametrize("failure", list(FAILURES), ids=list(FAILURES))
def test_live_quotes_come_back_empty_instead_of_raising(monkeypatch, failure):
    from app.services import live_price_service

    _install_price_board(monkeypatch, FAILURES[failure])

    assert live_price_service.get_live_quotes(["FPT", "ZZZ"]) == {}
    assert live_price_service.symbol_exists("ZZZ") is False


def test_live_quotes_fall_back_to_the_stale_cache(monkeypatch):
    from app.services import live_price_service

    _install_price_board(monkeypatch, FAILURES["rate_limit"])
    old_quote = {"symbol": "FPT", "price": 100.0}
    monkeypatch.setattr(live_price_service, "_cache", {"FPT": {"data": old_quote, "fetched_at": 0}})

    assert live_price_service.get_live_quotes(["FPT"]) == {"FPT": old_quote}
