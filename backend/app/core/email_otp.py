"""Mã OTP 6 số gửi qua email, lưu tạm trong RAM tiến trình.

Cùng giới hạn như ratelimit.py: chạy nhiều worker thì mỗi worker có kho mã
riêng, khởi động lại thì mã mất hết. Đủ dùng ở quy mô hiện tại — xem README
mục "Giới hạn đã biết". Mỗi mã dùng được đúng một lần (xoá ngay sau khi đúng)
và hết hạn sau OTP_TTL_SECONDS; verify_code cũng tự xoá mã sau
MAX_VERIFY_ATTEMPTS lần thử sai để chặn dò mã.
"""

import random
import threading
import time
from dataclasses import dataclass

OTP_TTL_SECONDS = 10 * 60
MAX_VERIFY_ATTEMPTS = 5


@dataclass
class _Entry:
    code: str
    expires_at: float
    attempts: int = 0


_store: dict[str, _Entry] = {}
_lock = threading.Lock()


def issue_code(email: str) -> str:
    code = f"{random.randint(0, 999999):06d}"
    with _lock:
        _store[email] = _Entry(code=code, expires_at=time.monotonic() + OTP_TTL_SECONDS)
    return code


def verify_code(email: str, code: str) -> bool:
    with _lock:
        entry = _store.get(email)
        if entry is None:
            return False
        if time.monotonic() > entry.expires_at:
            del _store[email]
            return False
        entry.attempts += 1
        if entry.attempts > MAX_VERIFY_ATTEMPTS or entry.code != code:
            if entry.attempts > MAX_VERIFY_ATTEMPTS:
                del _store[email]
            return False
        # Đúng mã — dùng một lần, xoá ngay để chống phát lại.
        del _store[email]
        return True


def reset() -> None:
    """Dùng trong test để mỗi ca chạy trên trạng thái sạch."""
    with _lock:
        _store.clear()
