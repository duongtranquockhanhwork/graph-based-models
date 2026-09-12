"""PATCH /api/auth/me — cập nhật họ tên, ngày sinh, và avatar (data URI ảnh
nén ở client, không phải URL ngoài — xem ProfileEditForm.tsx)."""

from tests.conftest import auth

TINY_PNG_DATA_URI = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk"
    "+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


class TestUpdateAvatar:
    def test_set_avatar_with_valid_data_uri(self, client, user_token):
        r = client.patch(
            "/api/auth/me",
            headers=auth(user_token),
            json={"full_name": "Test User", "avatar_url": TINY_PNG_DATA_URI},
        )
        assert r.status_code == 200, r.text
        assert r.json()["avatar_url"] == TINY_PNG_DATA_URI

    def test_external_url_rejected(self, client, user_token):
        r = client.patch(
            "/api/auth/me",
            headers=auth(user_token),
            json={"full_name": "Test User", "avatar_url": "https://evil.example/x.png"},
        )
        assert r.status_code == 422

    def test_oversized_avatar_rejected(self, client, user_token):
        huge = "data:image/png;base64," + ("A" * 500_000)
        r = client.patch(
            "/api/auth/me",
            headers=auth(user_token),
            json={"full_name": "Test User", "avatar_url": huge},
        )
        assert r.status_code == 422

    def test_empty_string_clears_avatar(self, client, user_token):
        client.patch(
            "/api/auth/me",
            headers=auth(user_token),
            json={"full_name": "Test User", "avatar_url": TINY_PNG_DATA_URI},
        )
        r = client.patch(
            "/api/auth/me",
            headers=auth(user_token),
            json={"full_name": "Test User", "avatar_url": ""},
        )
        assert r.status_code == 200
        assert r.json()["avatar_url"] is None

    def test_omitting_avatar_leaves_it_unchanged(self, client, user_token):
        client.patch(
            "/api/auth/me",
            headers=auth(user_token),
            json={"full_name": "Test User", "avatar_url": TINY_PNG_DATA_URI},
        )
        r = client.patch(
            "/api/auth/me",
            headers=auth(user_token),
            json={"full_name": "Test User Renamed"},
        )
        assert r.status_code == 200
        assert r.json()["avatar_url"] == TINY_PNG_DATA_URI
        assert r.json()["full_name"] == "Test User Renamed"
