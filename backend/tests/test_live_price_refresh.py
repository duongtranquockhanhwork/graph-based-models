"""Tự cập nhật giá khi một bài mới cần phiên giá gần hơn bảng giá đang có.

Hai điều phải luôn đúng:

1. Một bài chỉ được chấm lại sau khi đã có giá mới, và chỉ một lần.
2. Mọi thất bại khi tải giá kết thúc bằng một lời từ chối có lý do — không bao
   giờ bằng một kết quả chấm trên giá cũ. Đó là lỗi đã xảy ra thật: bảng giá
   dừng ở 03/09, một nửa số mã dừng sớm hơn một phiên, và bài mới vẫn được chấm
   bình thường trên cửa sổ giá lệch cả tuần mà không có gì báo.
"""

import os
import sys
import types

import pytest

from app.services import finnexus_service as fs

LAGGING_REFUSAL = {
    "status": "REFUSED",
    "stage": "prices",
    "reason": "price_panel_behind_publication",
    "detail": {
        "newest_price_session": "2026-09-03",
        "missing_sessions": ["2026-09-04"],
        "symbols": ["HPG", "FPT"],
    },
}
SCORED_WITH_ONE_LAGGING = {
    "status": "SCORED",
    "scored": [],
    "refused": [
        {"symbol": "HPG", "reason": "price_history_behind_publication"},
        {"symbol": "XYZ", "reason": "insufficient_price_history"},
    ],
}


def test_lagging_symbols_come_from_either_shape_of_result():
    assert fs._lagging_symbols(LAGGING_REFUSAL) == ["FPT", "HPG"]
    assert fs._lagging_symbols(SCORED_WITH_ONE_LAGGING) == ["HPG"]
    per_symbol = {
        "status": "REFUSED",
        "reason": "price_history_behind_publication",
        "detail": {"newest_session_by_symbol": {"VNM": "2026-08-28"}, "symbols": ["VNM", "FPT"]},
    }
    assert fs._lagging_symbols(per_symbol) == ["VNM"]
    assert fs._lagging_symbols({"status": "REFUSED", "reason": "no_symbol_found", "detail": {}}) == []


def test_every_price_refusal_has_a_plain_message():
    detail = {"newest_price_session": "2026-09-03", "missing_sessions": ["2026-09-04"]}
    for reason in (
        "price_panel_behind_publication",
        "price_history_behind_publication",
        "price_history_too_stale_for_this_article",
    ):
        assert "dừng lại giữa chừng" not in fs._humanize_refusal("prices", reason, detail)
    assert "2026-09-03" in fs._humanize_refusal("prices", "price_panel_behind_publication", detail)


@pytest.fixture()
def fake_model(monkeypatch):
    state = {"config": {"features": {"live": {"enabled": True}}}, "resources": {}}
    monkeypatch.setattr(fs, "_ensure_loaded", lambda: state)
    return state


def test_a_lagging_article_is_rescored_once_after_a_refresh(fake_model, monkeypatch):
    calls, refreshed = [], []

    def score_once(article, state):
        calls.append(article["published_date"])
        return LAGGING_REFUSAL if len(calls) == 1 else {"status": "SCORED", "scored": [], "refused": []}

    monkeypatch.setattr(fs, "_score_once", score_once)
    monkeypatch.setattr(fs, "_refresh_prices", lambda state, symbols: refreshed.append(symbols) or True)
    result = fs.score_article("Cổ phiếu FPT", "", "2026-09-11")
    assert len(calls) == 2
    assert refreshed == [["FPT", "HPG"]]
    assert result["status"] == "SCORED"
    assert result["prices_refreshed_for"] == ["FPT", "HPG"]


def test_a_failed_refresh_keeps_the_refusal(fake_model, monkeypatch):
    calls = []
    monkeypatch.setattr(fs, "_score_once", lambda a, s: calls.append(1) or LAGGING_REFUSAL)
    monkeypatch.setattr(fs, "_refresh_prices", lambda state, symbols: False)
    result = fs.score_article("Cổ phiếu FPT", "", "2026-09-11")
    assert len(calls) == 1
    assert result["reason"] == "price_panel_behind_publication"


def test_other_refusals_never_trigger_a_refresh(fake_model, monkeypatch):
    monkeypatch.setattr(
        fs, "_score_once", lambda a, s: {"status": "REFUSED", "reason": "no_symbol_found", "detail": {}}
    )

    def must_not_run(*args):
        raise AssertionError("không được tải giá cho lý do từ chối này")

    monkeypatch.setattr(fs, "_refresh_prices", must_not_run)
    assert fs.score_article("x", "", "2026-09-11")["reason"] == "no_symbol_found"


def test_refresh_is_off_when_the_setting_is_off(fake_model, monkeypatch):
    monkeypatch.setattr(fs.settings, "FINNEXUS_LIVE_PRICES", False)
    assert fs._refresh_prices(fake_model, ["FPT"]) is False


def test_refresh_needs_a_live_overlay_in_the_model_config(monkeypatch):
    monkeypatch.setattr(fs.settings, "FINNEXUS_LIVE_PRICES", True)
    assert fs._refresh_prices({"config": {"features": {}}, "resources": {}}, ["FPT"]) is False


def test_the_price_board_turns_the_providers_exit_into_an_error(monkeypatch):
    """vnstock gọi sys.exit khi vượt hạn mức; máy chủ web không được chết theo."""
    from app.services import live_price_service

    class Trading:
        def __init__(self, source):
            pass

        def price_board(self, symbols_list):
            sys.exit("Rate limit exceeded. Process terminated.")

    monkeypatch.setitem(sys.modules, "vnstock", types.SimpleNamespace(Trading=Trading))
    with pytest.raises(RuntimeError):
        live_price_service._fetch_quotes(["FPT"])


# --------------------------------------------------------------------------
# Với mô hình thật (chỉ chạy khi có FINNEXUS_ROOT, như test đối chiếu đặc trưng)
# --------------------------------------------------------------------------


@pytest.fixture(scope="module")
def real_model():
    root = (os.environ.get("FINNEXUS_PARITY_ROOT") or "").strip()
    if not root or not os.path.isdir(root):
        pytest.skip("Đặt FINNEXUS_ROOT trỏ tới bản mô hình để chạy kiểm tra này")
    from app.core.config import settings

    previous = (settings.FINNEXUS_ROOT, settings.FINNEXUS_LIVE_PRICES)
    settings.FINNEXUS_ROOT = root
    # Test không gọi mạng: nó kiểm tra lớp giá đã có, không tải thêm.
    settings.FINNEXUS_LIVE_PRICES = False
    fs.reset()
    try:
        try:
            state = fs._ensure_loaded()
        except fs.ModelUnavailable as exc:
            pytest.skip(f"Không nạp được mô hình: {exc}")
        if not state["resources"].get("live"):
            pytest.skip("Chưa có lớp giá live — chạy scripts/dataset_build/update_live_price_panel.py")
        yield state
    finally:
        settings.FINNEXUS_ROOT, settings.FINNEXUS_LIVE_PRICES = previous
        fs.reset()


def _day_after_newest_session(state):
    import pandas as pd

    day = pd.Timestamp(state["resources"]["live"]["newest_session"]) + pd.Timedelta(days=1)
    while day.weekday() >= 5:
        day += pd.Timedelta(days=1)
    return str(day.date())


ARTICLE = {
    "title": "Cổ phiếu FPT tăng mạnh",
    "content": "Cổ phiếu FPT của Công ty Cổ phần FPT tăng mạnh trong phiên.",
    "url": "",
    "source": "CafeF",
}


def test_a_current_article_is_scored_on_the_newest_session(real_model):
    newest = real_model["resources"]["live"]["newest_session"]
    result = fs.score_article(
        ARTICLE["title"], ARTICLE["content"], _day_after_newest_session(real_model)
    )
    assert result["status"] == "SCORED", result
    row = next(r for r in result["scored"] if r["symbol"] == "FPT")
    assert row["last_price_session"] == newest
    assert result["price_data"]["window_ends_on"] == newest
    # Giá tham chiếu cho bảng giá vào lệnh: phiên mới nhất người đọc thấy được.
    assert row["reference_session"] == newest
    assert row["reference_close"] and row["reference_close"] > 0
    assert row["volatility_20d"] is not None


def test_without_the_overlay_the_article_is_refused_not_scored_on_old_prices(real_model):
    resources = dict(real_model["resources"])
    resources["live"] = None
    state = {"config": real_model["config"], "resources": resources}
    article = dict(ARTICLE, published_date=_day_after_newest_session(real_model))
    result = fs._score_once(article, state)
    assert result["status"] == "REFUSED"
    assert result["reason"] == "price_panel_behind_publication"
