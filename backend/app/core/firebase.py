"""Khởi tạo firebase-admin để verify ID token từ luồng đăng nhập SĐT (OTP).

Lazy-init: không cấu hình thì get_firebase_app() trả None, router tự raise
503 thay vì để lỗi import/khởi tạo làm sập toàn bộ ứng dụng lúc chưa cần
tính năng này.
"""

import logging
import threading

import firebase_admin
from firebase_admin import credentials

from app.core.config import settings

logger = logging.getLogger(__name__)

_app = None
_lock = threading.Lock()


def get_firebase_app():
    global _app
    if _app is not None:
        return _app
    if not settings.FIREBASE_PROJECT_ID:
        return None
    with _lock:
        if _app is not None:
            return _app
        try:
            cred = (
                credentials.Certificate(settings.FIREBASE_CREDENTIALS_JSON)
                if settings.FIREBASE_CREDENTIALS_JSON
                else credentials.ApplicationDefault()
            )
            _app = firebase_admin.initialize_app(
                cred, {"projectId": settings.FIREBASE_PROJECT_ID}, name="finnexus-phone-auth"
            )
        except Exception:
            logger.exception("Không khởi tạo được firebase-admin")
            return None
    return _app
