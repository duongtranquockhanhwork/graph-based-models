"""Test hồi quy cho bốn lỗi tìm ra khi rà soát mã nguồn trước buổi bảo vệ.

1. Mã OTP phải sinh bằng bộ sinh ngẫu nhiên an toàn cho mật mã.
2. Header X-Real-IP do client tự gửi không được dùng để né rate limit.
3. Một bài lỗi khi phân tích nền không được chặn các bài còn lại trong lô.
4. Lọc tin theo mã / sự kiện không được bỏ sót kết quả khi phân trang.
"""

from starlette.requests import Request

from tests.conftest import auth


# ----------------------------------------------------------------------------
# 1. OTP
# ----------------------------------------------------------------------------

def test_otp_is_drawn_from_the_secrets_module(monkeypatch):
    from app.core import email_otp

    assert not hasattr(email_otp, "random"), "OTP không được sinh bằng module random"
    monkeypatch.setattr(email_otp.secrets, "randbelow", lambda n: 42)

    assert email_otp.issue_code("csprng@example.com") == "000042"
    assert email_otp.verify_code("csprng@example.com", "000042") is True


def test_otp_with_unusual_characters_is_just_a_wrong_code():
    from app.core import email_otp

    email_otp.issue_code("odd-code@example.com")
    assert email_otp.verify_code("odd-code@example.com", "１２３４５６") is False


# ----------------------------------------------------------------------------
# 2. X-Real-IP
# ----------------------------------------------------------------------------

def _request(peer: str, real_ip: str | None) -> Request:
    headers = [(b"x-real-ip", real_ip.encode())] if real_ip else []
    return Request({"type": "http", "method": "POST", "path": "/", "headers": headers, "client": (peer, 5000)})


def test_x_real_ip_is_ignored_from_an_untrusted_peer(monkeypatch):
    from app.core import ratelimit

    monkeypatch.setattr(ratelimit.settings, "TRUSTED_PROXY_IPS", "")
    assert ratelimit._client_key(_request("198.51.100.7", "203.0.113.9"), "login") == "login:198.51.100.7"


def test_x_real_ip_is_used_only_behind_a_trusted_proxy(monkeypatch):
    from app.core import ratelimit

    monkeypatch.setattr(ratelimit.settings, "TRUSTED_PROXY_IPS", "172.16.0.0/12")
    assert ratelimit._client_key(_request("172.18.0.5", "203.0.113.9"), "login") == "login:203.0.113.9"
    assert ratelimit._client_key(_request("198.51.100.7", "203.0.113.9"), "login") == "login:198.51.100.7"


def test_rotating_x_real_ip_does_not_escape_the_login_limit(client):
    codes = [
        client.post(
            "/api/auth/login",
            headers={"X-Real-IP": f"203.0.113.{i}"},
            json={"email": "admin@finnexus.dev", "password": f"wrong{i}"},
        ).status_code
        for i in range(14)
    ]
    assert 429 in codes, "Đổi X-Real-IP mỗi request đã né được giới hạn đăng nhập"


# ----------------------------------------------------------------------------
# 3. Tác vụ nền
# ----------------------------------------------------------------------------

def test_one_failing_article_does_not_stop_the_rest_of_the_batch(client, user_token, monkeypatch):
    from app.core.database import SessionLocal
    from app.models.news import NewsArticle
    from app.routers import news as news_router
    from app.services import watchlist_service

    real_analyze = news_router.analyze_article

    def flaky(title, content, db=None):
        if "HỎNG" in title:
            raise RuntimeError("lỗi giả lập khi phân tích")
        return real_analyze(title, content, db=db)

    monkeypatch.setattr(news_router, "analyze_article", flaky)
    monkeypatch.setattr(watchlist_service, "add_symbol", lambda db, user_id, symbol: None)

    csv = "\n".join([
        "title,content",
        '"Cổ phiếu FPT tăng mạnh","FPT báo lãi tăng."',
        '"Bài HỎNG giữa lô","Nội dung bất kỳ."',
        '"Cổ phiếu VNM chia cổ tức","Vinamilk chia cổ tức tiền mặt."',
    ])
    r = client.post(
        "/api/news/upload-csv",
        headers=auth(user_token),
        files={"file": ("batch.csv", csv.encode("utf-8"), "text/csv")},
    )
    assert r.status_code == 200, r.text
    ids = r.json()["ids"]
    assert len(ids) == 3

    with SessionLocal() as db:
        rows = {n.id: n for n in db.query(NewsArticle).filter(NewsArticle.id.in_(ids))}
        assert all(n.is_analyzed for n in rows.values()), "có bài không được phân tích"
        failed = [n for n in rows.values() if "HỎNG" in n.title]
        others = [n for n in rows.values() if "HỎNG" not in n.title]
        assert failed[0].prediction_decision == "ERROR"
        assert failed[0].prediction_explanation["status"] == "ERROR"
        assert all(n.prediction_decision != "ERROR" for n in others)

    status = client.post("/api/news/analysis-status", headers=auth(user_token), json={"ids": ids}).json()
    assert status["done"] is True and status["pending"] == 0


# ----------------------------------------------------------------------------
# 4. Lọc chính xác và phân trang
# ----------------------------------------------------------------------------

def _insert(title: str, stocks=None, events=None, email: str = "test1@finnexus.dev") -> int:
    from app.core.database import SessionLocal
    from app.models.news import NewsArticle
    from app.models.user import User

    with SessionLocal() as db:
        owner = db.query(User).filter(User.email == email).one()
        article = NewsArticle(
            owner_id=owner.id,
            title=title,
            stocks_mentioned=stocks or [],
            events_detected=events or [],
            is_analyzed=True,
        )
        db.add(article)
        db.commit()
        return article.id


def test_stock_filter_finds_exact_matches_beyond_the_coarse_window(client, user_token):
    older = _insert("Bài thật về ZQX (cũ hơn)", stocks=["ZQX"])
    newer = _insert("Bài thật về ZQX (mới hơn)", stocks=["ZQX"])
    # 12 bài mới hơn khớp LIKE '%ZQX%' nhưng không phải mã ZQX.
    for i in range(12):
        _insert(f"Bài mồi {i}", stocks=["ZQXA"])

    first = client.get("/api/news/", headers=auth(user_token), params={"stock": "ZQX", "limit": 1}).json()
    second = client.get(
        "/api/news/", headers=auth(user_token), params={"stock": "ZQX", "limit": 1, "skip": 1}
    ).json()

    assert [n["id"] for n in first] == [newer]
    assert [n["id"] for n in second] == [older]


def test_event_filter_finds_exact_matches_beyond_the_coarse_window(client, user_token):
    target = _insert("Bài có sự kiện zqx_event", events=["zqx_event"])
    for i in range(12):
        _insert(f"Bài mồi sự kiện {i}", events=["zqx_event_decoy"])

    rows = client.get(
        "/api/news/", headers=auth(user_token), params={"event_type": "zqx_event", "limit": 2}
    ).json()

    assert [n["id"] for n in rows] == [target]
