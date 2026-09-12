"""Test cho đăng ký/đăng nhập bằng SĐT (Firebase Phone Auth) và bằng email
(mã OTP 6 số).

Không gọi Firebase/SMTP thật — verify_id_token và get_firebase_app được mock
cho SĐT; email OTP không cần mock vì SMTP_HOST rỗng trong test env nên
send_otp_email chỉ log thay vì gửi thật (issue_code vẫn lưu mã vào kho RAM
bình thường, test gọi thẳng issue_code để lấy mã thay vì phải đọc log email).
Các test này kiểm tra logic backend: tạo mới khi chưa có tài khoản, đăng nhập
khi đã có, và việc bắt buộc họ tên + ngày sinh + mật khẩu khi tạo tài khoản
mới (yêu cầu sản phẩm: không được đăng ký chỉ bằng SĐT/email trần).
"""

from unittest.mock import patch

from tests.conftest import auth

STRONG_PASSWORD = "Str0ng!Pass1"


def _mock_decoded_token(phone="+84912345678", uid="firebase-uid-1"):
    return {"phone_number": phone, "uid": uid}


def _create_user_with_token(email: str, password: str = STRONG_PASSWORD) -> tuple:
    """Tạo user độc lập qua DB rồi đăng nhập lấy token — dùng cho test cần
    một tài khoản KHÔNG phải các tài khoản seed dùng chung (test/admin), vì
    một số test ở đây đổi email/SĐT của current_user và không được làm hỏng
    thông tin đăng nhập mà fixture user_token/admin_token phụ thuộc vào."""
    from app.core.database import SessionLocal
    from app.core.security import hash_password
    from app.models.user import User

    with SessionLocal() as db:
        user = User(
            email=email,
            hashed_password=hash_password(password),
            full_name="Independent Test User",
            email_verified=True,
        )
        from datetime import date

        user.date_of_birth = date(1990, 1, 1)
        db.add(user)
        db.commit()

    return email, password


class TestFirebasePhoneNotConfigured:
    def test_returns_503_when_firebase_not_configured(self, client):
        # conftest không đặt FIREBASE_PROJECT_ID -> get_firebase_app() trả None.
        r = client.post("/api/auth/firebase-phone", json={"id_token": "whatever"})
        assert r.status_code == 503

    def test_link_phone_returns_503_when_firebase_not_configured(self, client, user_token):
        r = client.post(
            "/api/auth/link-phone", headers=auth(user_token), json={"id_token": "whatever"}
        )
        assert r.status_code == 503


class TestFirebasePhoneRegistration:
    @patch("app.routers.auth.get_firebase_app", return_value=object())
    @patch("app.routers.auth.firebase_auth.verify_id_token")
    def test_new_number_requires_full_name_dob_password(self, mock_verify, _mock_app, client):
        mock_verify.return_value = _mock_decoded_token(uid="new-user-1")
        r = client.post("/api/auth/firebase-phone", json={"id_token": "tok"})
        assert r.status_code == 400, r.text

    @patch("app.routers.auth.get_firebase_app", return_value=object())
    @patch("app.routers.auth.firebase_auth.verify_id_token")
    def test_new_number_missing_password_rejected(self, mock_verify, _mock_app, client):
        mock_verify.return_value = _mock_decoded_token(uid="new-user-nopass", phone="+84987600000")
        r = client.post(
            "/api/auth/firebase-phone",
            json={"id_token": "tok", "full_name": "Nguyen Van A", "date_of_birth": "1995-05-20"},
        )
        assert r.status_code == 400, r.text

    @patch("app.routers.auth.get_firebase_app", return_value=object())
    @patch("app.routers.auth.firebase_auth.verify_id_token")
    def test_new_number_with_all_fields_creates_verified_account(self, mock_verify, _mock_app, client):
        mock_verify.return_value = _mock_decoded_token(uid="new-user-2", phone="+84987654321")
        r = client.post(
            "/api/auth/firebase-phone",
            json={
                "id_token": "tok",
                "full_name": "Nguyen Van A",
                "date_of_birth": "1995-05-20",
                "password": STRONG_PASSWORD,
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user"]["phone"] == "+84987654321"
        assert body["user"]["phone_verified"] is True
        assert body["user"]["profile_complete"] is True

    @patch("app.routers.auth.get_firebase_app", return_value=object())
    @patch("app.routers.auth.firebase_auth.verify_id_token")
    def test_dob_in_future_rejected(self, mock_verify, _mock_app, client):
        mock_verify.return_value = _mock_decoded_token(uid="new-user-future", phone="+84987600001")
        r = client.post(
            "/api/auth/firebase-phone",
            json={
                "id_token": "tok",
                "full_name": "Nguyen Van A",
                "date_of_birth": "2999-01-01",
                "password": STRONG_PASSWORD,
            },
        )
        assert r.status_code == 422, r.text

    @patch("app.routers.auth.get_firebase_app", return_value=object())
    @patch("app.routers.auth.firebase_auth.verify_id_token")
    def test_same_uid_logs_in_without_requiring_fields_again(self, mock_verify, _mock_app, client):
        mock_verify.return_value = _mock_decoded_token(uid="repeat-user", phone="+84900000001")
        first = client.post(
            "/api/auth/firebase-phone",
            json={
                "id_token": "tok",
                "full_name": "B",
                "date_of_birth": "1990-01-01",
                "password": STRONG_PASSWORD,
            },
        )
        assert first.status_code == 200
        first_user_id = first.json()["user"]["id"]

        second = client.post("/api/auth/firebase-phone", json={"id_token": "tok"})
        assert second.status_code == 200, second.text
        assert second.json()["user"]["id"] == first_user_id

    @patch("app.routers.auth.get_firebase_app", return_value=object())
    @patch("app.routers.auth.firebase_auth.verify_id_token", side_effect=ValueError("bad token"))
    def test_invalid_token_returns_401(self, _mock_verify, _mock_app, client):
        r = client.post("/api/auth/firebase-phone", json={"id_token": "garbage"})
        assert r.status_code == 401


class TestLinkPhone:
    def test_requires_authentication(self, client):
        r = client.post("/api/auth/link-phone", json={"id_token": "tok"})
        assert r.status_code == 401

    @patch("app.routers.auth.get_firebase_app", return_value=object())
    @patch("app.routers.auth.firebase_auth.verify_id_token")
    def test_links_phone_to_current_user(self, mock_verify, _mock_app, client, user_token):
        mock_verify.return_value = _mock_decoded_token(uid="link-uid-1", phone="+84911111111")
        r = client.post("/api/auth/link-phone", headers=auth(user_token), json={"id_token": "tok"})
        assert r.status_code == 200, r.text
        assert r.json()["phone"] == "+84911111111"
        assert r.json()["phone_verified"] is True

    @patch("app.routers.auth.get_firebase_app", return_value=object())
    @patch("app.routers.auth.firebase_auth.verify_id_token")
    def test_rejects_phone_already_linked_to_another_user(
        self, mock_verify, _mock_app, client, user_token, other_user_token
    ):
        mock_verify.return_value = _mock_decoded_token(uid="link-uid-2", phone="+84922222222")
        first = client.post("/api/auth/link-phone", headers=auth(user_token), json={"id_token": "tok"})
        assert first.status_code == 200

        mock_verify.return_value = _mock_decoded_token(uid="link-uid-3", phone="+84922222222")
        second = client.post(
            "/api/auth/link-phone", headers=auth(other_user_token), json={"id_token": "tok"}
        )
        assert second.status_code == 400


class TestEmailOtp:
    def test_request_returns_generic_message(self, client):
        r = client.post("/api/auth/email-otp/request", json={"email": "otp-req@example.com"})
        assert r.status_code == 200

    def test_wrong_code_rejected(self, client):
        from app.core.email_otp import issue_code

        issue_code("otp-wrong@example.com")
        r = client.post(
            "/api/auth/email-otp/verify", json={"email": "otp-wrong@example.com", "code": "000000"}
        )
        assert r.status_code == 401

    def test_new_email_requires_full_name_dob_password(self, client):
        from app.core.email_otp import issue_code

        code = issue_code("otp-new@example.com")
        r = client.post(
            "/api/auth/email-otp/verify", json={"email": "otp-new@example.com", "code": code}
        )
        assert r.status_code == 400, r.text

    def test_new_email_with_all_fields_creates_verified_account(self, client):
        from app.core.email_otp import issue_code

        code = issue_code("otp-full@example.com")
        r = client.post(
            "/api/auth/email-otp/verify",
            json={
                "email": "otp-full@example.com",
                "code": code,
                "full_name": "C",
                "date_of_birth": "1988-08-08",
                "password": STRONG_PASSWORD,
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user"]["email"] == "otp-full@example.com"
        assert body["user"]["email_verified"] is True
        assert body["user"]["profile_complete"] is True

    def test_dob_in_future_rejected(self, client):
        from app.core.email_otp import issue_code

        code = issue_code("otp-future@example.com")
        r = client.post(
            "/api/auth/email-otp/verify",
            json={
                "email": "otp-future@example.com",
                "code": code,
                "full_name": "E",
                "date_of_birth": "2999-01-01",
                "password": STRONG_PASSWORD,
            },
        )
        assert r.status_code == 422, r.text

    def test_code_is_single_use(self, client):
        from app.core.email_otp import issue_code

        code = issue_code("otp-once@example.com")
        first = client.post(
            "/api/auth/email-otp/verify",
            json={
                "email": "otp-once@example.com",
                "code": code,
                "full_name": "D",
                "date_of_birth": "1988-08-08",
                "password": STRONG_PASSWORD,
            },
        )
        assert first.status_code == 200

        second = client.post(
            "/api/auth/email-otp/verify", json={"email": "otp-once@example.com", "code": code}
        )
        assert second.status_code == 401

    def test_existing_email_logs_in_via_otp_without_fields(self, client):
        from app.core.email_otp import issue_code

        first_code = issue_code("otp-repeat@example.com")
        first = client.post(
            "/api/auth/email-otp/verify",
            json={
                "email": "otp-repeat@example.com",
                "code": first_code,
                "full_name": "F",
                "date_of_birth": "1988-08-08",
                "password": STRONG_PASSWORD,
            },
        )
        assert first.status_code == 200
        first_id = first.json()["user"]["id"]

        second_code = issue_code("otp-repeat@example.com")
        second = client.post(
            "/api/auth/email-otp/verify", json={"email": "otp-repeat@example.com", "code": second_code}
        )
        assert second.status_code == 200, second.text
        assert second.json()["user"]["id"] == first_id


class TestLinkEmail:
    def test_requires_authentication(self, client):
        r = client.post("/api/auth/link-email", json={"email": "x@example.com", "code": "123456"})
        assert r.status_code == 401

    def test_links_email_to_current_user(self, client):
        from app.core.email_otp import issue_code

        # Tài khoản độc lập (không phải fixture dùng chung) — link-email đổi
        # current_user.email, nên không được đụng vào test1@finnexus.dev mà
        # fixture user_token còn cần đăng nhập lại ở các test khác.
        email, password = _create_user_with_token("link-owner@example.com")
        login = client.post("/api/auth/login", json={"email": email, "password": password})
        token = login.json()["access_token"]

        code = issue_code("link-target@example.com")
        r = client.post(
            "/api/auth/link-email", headers=auth(token), json={"email": "link-target@example.com", "code": code}
        )
        assert r.status_code == 200, r.text
        assert r.json()["email"] == "link-target@example.com"
        assert r.json()["email_verified"] is True

    def test_rejects_email_already_linked_to_another_user(self, client):
        from app.core.email_otp import issue_code

        email_a, password_a = _create_user_with_token("owner-a@example.com")
        email_b, password_b = _create_user_with_token("owner-b@example.com")
        token_a = client.post("/api/auth/login", json={"email": email_a, "password": password_a}).json()[
            "access_token"
        ]
        token_b = client.post("/api/auth/login", json={"email": email_b, "password": password_b}).json()[
            "access_token"
        ]

        code_a = issue_code("shared-target@example.com")
        first = client.post(
            "/api/auth/link-email",
            headers=auth(token_a),
            json={"email": "shared-target@example.com", "code": code_a},
        )
        assert first.status_code == 200

        code_b = issue_code("shared-target@example.com")
        second = client.post(
            "/api/auth/link-email",
            headers=auth(token_b),
            json={"email": "shared-target@example.com", "code": code_b},
        )
        assert second.status_code == 400
