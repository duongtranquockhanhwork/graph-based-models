"""Cấu hình chung cho test.

Mỗi ca chạy trên một cơ sở dữ liệu SQLite riêng trong thư mục tạm, nên test
không đụng tới dữ liệu phát triển và không phụ thuộc thứ tự chạy.

Mô hình FinNexus KHÔNG được nạp trong test (``FINNEXUS_ROOT`` để trống). Test ở
đây kiểm tra hành vi của tầng web — phân quyền, chặn SSRF, vòng đời phiên,
hợp đồng API — chứ không kiểm tra lại mô hình; repo nghiên cứu đã có bộ kiểm
định riêng cho nó. Đường dẫn "mô hình không khả dụng" cũng chính là đường dẫn
cần được kiểm tra kỹ nhất, vì đó là lúc hệ thống dễ âm thầm bịa kết quả nhất.
"""

import os
import sys
import tempfile
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

_TMPDIR = tempfile.mkdtemp(prefix="finnexus-tests-")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_TMPDIR}/test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-not-used-anywhere-real")
os.environ.setdefault("ENVIRONMENT", "development")
# Cất giá trị gốc sang một tên khác TRƯỚC khi xoá. Bộ test đối chiếu đặc trưng
# (test_feature_parity.py) bắt buộc phải có mô hình thật, nên nó đọc biến này và
# tự bật lại trong phạm vi của riêng nó rồi trả về nguyên trạng. Mọi test còn
# lại vẫn thấy "mô hình không khả dụng", đúng như đoạn ghi chú ở đầu file.
os.environ["FINNEXUS_PARITY_ROOT"] = os.environ.get("FINNEXUS_ROOT", "")
os.environ["FINNEXUS_ROOT"] = ""


@pytest.fixture(scope="session")
def app_module():
    import main

    return main


@pytest.fixture()
def client(app_module):
    from fastapi.testclient import TestClient

    from app.core import ratelimit

    # Bộ đếm rate limit nằm trong RAM tiến trình. Xoá trước mỗi ca để một ca
    # gọi nhiều request không làm ca sau nhận 429.
    ratelimit.reset()
    with TestClient(app_module.app) as c:
        yield c


@pytest.fixture()
def admin_token(client):
    r = client.post(
        "/api/auth/login",
        json={"email": "admin@finnexus.dev", "password": "Test@123456"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture()
def user_token(client):
    r = client.post(
        "/api/auth/login",
        json={"email": "test1@finnexus.dev", "password": "Test@123456"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture()
def other_user_token(client):
    r = client.post(
        "/api/auth/login",
        json={"email": "test2@finnexus.dev", "password": "Test@123456"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
