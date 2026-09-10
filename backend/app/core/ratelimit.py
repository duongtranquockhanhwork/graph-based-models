"""Giới hạn tần suất cho các endpoint nhạy cảm.

Bản trước không giới hạn gì: 12 lần đăng nhập sai trong 3 giây đều được xử lý.
Cửa sổ trượt trong bộ nhớ tiến trình là đủ cho quy mô hiện tại và không thêm
phụ thuộc hạ tầng.

Giới hạn của cách làm này, nói rõ để không ai nhầm: bộ đếm nằm trong RAM của
một tiến trình. Chạy nhiều worker thì mỗi worker có bộ đếm riêng, nên hạn mức
thực tế nhân lên theo số worker; khởi động lại thì bộ đếm về 0. Khi triển khai
nhiều worker, thay ``_MemoryBackend`` bằng Redis mà giữ nguyên interface.
"""

import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import HTTPException, Request, status


class _MemoryBackend:
    def __init__(self) -> None:
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        """Ghi nhận một lần gọi. Trả về ``(được_phép, số_giây_chờ)``."""
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            bucket = self._hits[key]
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= limit:
                retry_after = int(bucket[0] + window_seconds - now) + 1
                return False, max(retry_after, 1)
            bucket.append(now)
            return True, 0

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


_backend = _MemoryBackend()


def reset() -> None:
    """Dùng trong test để mỗi ca chạy trên trạng thái sạch."""
    _backend.reset()


def _client_key(request: Request, scope: str) -> str:
    # X-Forwarded-For chỉ đáng tin khi có reverse proxy ta kiểm soát đặt nó.
    # nginx trong repo này đặt X-Real-IP, nên ưu tiên nó rồi mới tới peer.
    ip = request.headers.get("x-real-ip") or (request.client.host if request.client else "unknown")
    return f"{scope}:{ip}"


class RateLimit:
    """Dependency cho FastAPI.

    Ví dụ::

        @router.post("/login", dependencies=[Depends(RateLimit("login", 10, 300))])
    """

    def __init__(self, scope: str, limit: int, window_seconds: int) -> None:
        self.scope, self.limit, self.window_seconds = scope, limit, window_seconds

    def __call__(self, request: Request) -> None:
        allowed, retry_after = _backend.hit(
            _client_key(request, self.scope), self.limit, self.window_seconds
        )
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.",
                headers={"Retry-After": str(retry_after)},
            )


# Các hạn mức dùng chung, đặt tên theo việc chúng bảo vệ.
login_limit = RateLimit("login", limit=10, window_seconds=300)
register_limit = RateLimit("register", limit=5, window_seconds=3600)
forgot_password_limit = RateLimit("forgot_password", limit=5, window_seconds=3600)
import_url_limit = RateLimit("import_url", limit=20, window_seconds=3600)
upload_limit = RateLimit("upload", limit=10, window_seconds=3600)
