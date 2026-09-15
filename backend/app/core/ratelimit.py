"""Giới hạn tần suất cho các endpoint nhạy cảm.

Bản trước không giới hạn gì: 12 lần đăng nhập sai trong 3 giây đều được xử lý.
Cửa sổ trượt trong bộ nhớ tiến trình là đủ cho quy mô hiện tại và không thêm
phụ thuộc hạ tầng.

Giới hạn của cách làm này, nói rõ để không ai nhầm: bộ đếm nằm trong RAM của
một tiến trình. Chạy nhiều worker thì mỗi worker có bộ đếm riêng, nên hạn mức
thực tế nhân lên theo số worker; khởi động lại thì bộ đếm về 0. Khi triển khai
nhiều worker, thay ``_MemoryBackend`` bằng Redis mà giữ nguyên interface.
"""

import ipaddress
import threading
import time
from collections import defaultdict, deque
from functools import lru_cache
from typing import Deque, Dict, Tuple

from fastapi import HTTPException, Request, status

from app.core.config import settings


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


@lru_cache(maxsize=8)
def _trusted_networks(raw: str) -> Tuple[ipaddress._BaseNetwork, ...]:
    networks = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            networks.append(ipaddress.ip_network(part, strict=False))
        except ValueError:
            continue
    return tuple(networks)


def _is_trusted_proxy(host: str | None) -> bool:
    if not host:
        return False
    try:
        addr = ipaddress.ip_address(host)
    except ValueError:
        return False
    return any(addr in net for net in _trusted_networks(settings.TRUSTED_PROXY_IPS))


def _client_key(request: Request, scope: str) -> str:
    """Khoá đếm theo IP người gọi.

    Bản trước ưu tiên header X-Real-IP bất kể ai gửi. Khi backend mở cổng trực
    tiếp, kẻ tấn công chỉ cần đổi header này mỗi request là có một bộ đếm mới,
    vượt mọi hạn mức đăng nhập và OTP. Giờ header chỉ được dùng khi kết nối
    đến từ reverse proxy nằm trong TRUSTED_PROXY_IPS (nginx của hệ thống).
    """
    peer = request.client.host if request.client else None
    ip = peer or "unknown"
    if _is_trusted_proxy(peer):
        forwarded = (request.headers.get("x-real-ip") or "").strip()
        if forwarded:
            ip = forwarded
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
forgot_password_limit = RateLimit("forgot_password", limit=5, window_seconds=3600)
# Gửi/xác thực OTP qua Firebase — giới hạn riêng vì mỗi lần gửi có thể tốn phí.
phone_verify_limit = RateLimit("phone_verify", limit=10, window_seconds=600)
# Gửi mã OTP qua email — giới hạn chặt hơn login vì mỗi lần gửi là một email thật.
email_otp_request_limit = RateLimit("email_otp_request", limit=5, window_seconds=3600)
email_otp_verify_limit = RateLimit("email_otp_verify", limit=10, window_seconds=600)
# Kiểm tra email đã có tài khoản chưa (trước khi bật nút gửi OTP đăng ký) —
# có hạn mức riêng vì endpoint này cố ý lộ email có tồn tại hay không, nên
# giới hạn tần suất để không bị lợi dụng dò danh sách email trong hệ thống.
email_exists_limit = RateLimit("email_exists", limit=30, window_seconds=3600)
import_url_limit = RateLimit("import_url", limit=20, window_seconds=3600)
upload_limit = RateLimit("upload", limit=10, window_seconds=3600)
