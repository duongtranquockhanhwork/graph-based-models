"""Test hồi quy cho các lỗ hổng đã được kiểm định phát hiện và vá.

Mỗi test ở đây tương ứng một lỗ hổng đã khai thác được trên bản trước. Chúng
tồn tại để lỗ hổng đó không quay lại — không phải để đạt độ phủ.
"""

import pytest

from tests.conftest import auth

PROTECTED_ENDPOINTS = [
    "/api/news/",
    "/api/graph/",
    "/api/analytics/dashboard",
    "/api/prediction/",
    "/api/admin/dashboard",
    "/api/watchlist/",
    "/api/stock-detail/FPT/overview",
]


class TestAuthentication:
    @pytest.mark.parametrize("path", PROTECTED_ENDPOINTS)
    def test_requires_token(self, client, path):
        assert client.get(path).status_code == 401

    def test_seeded_password_from_old_readme_is_dead(self, client):
        """Mật khẩu ``Test@123`` từng được ghi công khai trong README."""
        r = client.post(
            "/api/auth/login",
            json={"email": "admin@finnexus.dev", "password": "Test@123"},
        )
        assert r.status_code == 401

    @pytest.mark.parametrize("password", ["123456", "password", "Test@123", "abcdefghij"])
    def test_weak_passwords_rejected(self, password):
        """Đăng ký bằng email/mật khẩu trần đã bị gỡ (auth.py) — mật khẩu yếu
        giờ được chặn ở validate_password_strength, dùng chung cho mọi luồng
        có đặt mật khẩu (đổi mật khẩu, reset, đăng ký qua SĐT có password)."""
        from app.core.security import WeakPassword, validate_password_strength

        with pytest.raises(WeakPassword):
            validate_password_strength(password)


class TestAuthorization:
    def test_customer_cannot_reach_admin_area(self, client, user_token):
        assert client.get("/api/admin/dashboard", headers=auth(user_token)).status_code == 403
        assert client.get("/api/admin/users/", headers=auth(user_token)).status_code == 403

    def test_customer_cannot_delete_another_users_article(
        self, client, user_token, other_user_token
    ):
        """Lỗ hổng nghiêm trọng nhất về phân quyền của bản trước: DELETE
        /api/news/{id} không kiểm quyền, nên một tài khoản bất kỳ xoá được dữ
        liệu của toàn hệ thống."""
        created = client.post(
            "/api/news/",
            headers=auth(user_token),
            json={"title": "Bai cua nguoi dung 1", "content": "noi dung"},
        )
        assert created.status_code == 200
        news_id = created.json()["id"]

        assert client.delete(f"/api/news/{news_id}", headers=auth(other_user_token)).status_code == 403
        assert client.get(f"/api/news/{news_id}", headers=auth(user_token)).status_code == 200

    def test_customer_cannot_trigger_full_reanalysis(self, client, user_token):
        assert client.post("/api/news/analyze-all", headers=auth(user_token)).status_code == 403

    def test_admin_can_delete(self, client, admin_token):
        created = client.post(
            "/api/news/", headers=auth(admin_token), json={"title": "Bai de xoa"}
        )
        news_id = created.json()["id"]
        assert client.delete(f"/api/news/{news_id}", headers=auth(admin_token)).status_code == 200


class TestSsrf:
    """``/api/news/import-url`` từng tải bất kỳ URL nào người dùng gửi, kể cả
    dịch vụ nội bộ, rồi lưu nội dung thành bài báo đọc lại được."""

    @pytest.mark.parametrize(
        "url",
        [
            "http://127.0.0.1:8000/docs",
            "http://localhost:8000/health",
            "http://169.254.169.254/latest/meta-data/",
            "http://[::1]:8000/",
            "http://10.0.0.1/",
            "http://192.168.1.1/",
        ],
    )
    def test_internal_targets_rejected(self, client, user_token, url):
        r = client.post("/api/news/import-url", headers=auth(user_token), json={"url": url})
        assert r.status_code == 400
        assert "nội bộ" in r.json()["detail"]

    @pytest.mark.parametrize("url", ["file:///etc/passwd", "gopher://x/", "ftp://example.com/x"])
    def test_non_http_schemes_rejected(self, client, user_token, url):
        r = client.post("/api/news/import-url", headers=auth(user_token), json={"url": url})
        assert r.status_code == 400
        assert "http" in r.json()["detail"].lower()

    def test_error_message_does_not_leak_upstream_detail(self, client, user_token):
        """Bản trước trả nguyên văn lỗi kết nối, biến endpoint này thành công
        cụ dò quét cổng mạng nội bộ."""
        r = client.post(
            "/api/news/import-url",
            headers=auth(user_token),
            json={"url": "http://127.0.0.1:59999/"},
        )
        detail = r.json()["detail"]
        assert "Connection" not in detail
        assert "HTTPConnectionPool" not in detail
        assert "59999" not in detail


def _create_user(email: str, password: str, full_name: str = "T") -> None:
    """Tạo user trực tiếp qua DB, thay cho endpoint /register đã bị gỡ (đăng
    ký giờ bắt buộc xác thực OTP qua SĐT hoặc email — xem auth.py)."""
    from app.core.database import SessionLocal
    from app.core.security import hash_password
    from app.models.user import User

    with SessionLocal() as db:
        db.add(User(email=email, hashed_password=hash_password(password), full_name=full_name))
        db.commit()


class TestSessionLifecycle:
    def test_changing_password_revokes_old_tokens(self, client, app_module):
        email = "session-test@example.com"
        _create_user(email, "Str0ng!Pass1", "S")
        logged_in = client.post("/api/auth/login", json={"email": email, "password": "Str0ng!Pass1"})
        assert logged_in.status_code == 200
        old_token = logged_in.json()["access_token"]
        assert client.get("/api/auth/me", headers=auth(old_token)).status_code == 200

        changed = client.post(
            "/api/auth/change-password",
            headers=auth(old_token),
            json={"current_password": "Str0ng!Pass1", "new_password": "An0ther!Pass2"},
        )
        assert changed.status_code == 200

        # Token cũ phải chết ngay. Bản trước để nó sống hết 7 ngày, nên người
        # dùng đổi mật khẩu vì nghi bị xâm nhập vẫn để kẻ tấn công truy cập.
        assert client.get("/api/auth/me", headers=auth(old_token)).status_code == 401
        # Nhưng chính người vừa đổi thì không bị đăng xuất oan.
        assert client.get("/api/auth/me", headers=auth(changed.json()["access_token"])).status_code == 200

    def test_reset_token_is_single_use(self, client, app_module):
        from app.core.database import SessionLocal
        from app.core.security import create_reset_token
        from app.models.user import User

        email = "reset-test@example.com"
        _create_user(email, "Str0ng!Pass1")
        with SessionLocal() as db:
            user = db.query(User).filter(User.email == email).first()
            token = create_reset_token(user.email, user.token_version or 0)

        first = client.post(
            "/api/auth/reset-password", json={"token": token, "new_password": "Fresh!Pass99"}
        )
        assert first.status_code == 200

        # Bản trước chấp nhận cùng một link reset nhiều lần suốt 30 phút, nên
        # link bị lộ cho phép chiếm tài khoản lặp lại.
        second = client.post(
            "/api/auth/reset-password", json={"token": token, "new_password": "Other!Pass99"}
        )
        assert second.status_code == 400


class TestRateLimiting:
    def test_login_is_rate_limited(self, client):
        codes = [
            client.post(
                "/api/auth/login",
                json={"email": "admin@finnexus.dev", "password": f"wrong{i}"},
            ).status_code
            for i in range(14)
        ]
        assert 429 in codes, "Không có giới hạn tần suất: brute-force không bị chặn"
