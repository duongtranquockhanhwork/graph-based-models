"""Chặn SSRF cho tính năng import bài báo từ URL.

Bản trước nhận thẳng URL người dùng gửi và ``requests.get`` nó. Điều đó cho
phép bất kỳ tài khoản nào biến máy chủ thành công cụ đọc mạng nội bộ: trong
Docker Compose là ``http://neo4j:7474`` và ``postgres:5432``, trên cloud là
``http://169.254.169.254/latest/meta-data/`` (credential của instance role).
Nội dung trang nội bộ còn được lưu thành bài báo rồi đọc lại qua API.

Bốn lớp chặn ở đây, mỗi lớp bịt một cách lách:

1. Chỉ chấp nhận ``http``/``https`` — loại ``file://``, ``gopher://``.
2. Phân giải DNS TRƯỚC khi tải, từ chối mọi IP riêng/loopback/link-local.
   Chặn theo tên miền là không đủ: ``localtest.me`` trỏ về 127.0.0.1.
3. Tự đi theo redirect từng bước, kiểm tra lại IP ở MỖI chặng. Một trang công
   khai có thể trả 302 về ``169.254.169.254``.
4. Giới hạn dung lượng tải, để một URL trỏ tới file lớn không làm cạn RAM.

Thông điệp lỗi upstream không bao giờ được trả về nguyên văn cho client — bản
trước làm thế và biến chính lỗi kết nối thành công cụ dò quét cổng nội bộ.
"""

from __future__ import annotations

import ipaddress
import socket
from typing import Iterable, Optional, Tuple
from urllib.parse import urlparse, urlunparse

import requests

ALLOWED_SCHEMES = {"http", "https"}
MAX_REDIRECTS = 3
DEFAULT_TIMEOUT = 15

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


class UnsafeUrl(ValueError):
    """URL không được phép tải. Thông điệp an toàn để hiển thị cho người dùng."""


def _is_blocked_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return True
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_reserved
        or addr.is_multicast
        or addr.is_unspecified
    )


def _resolve(host: str, port: int) -> Iterable[str]:
    try:
        infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise UnsafeUrl("Không phân giải được tên miền của URL này.") from exc
    return {info[4][0] for info in infos}


def validate_url(raw_url: str) -> str:
    """Kiểm tra scheme, host và mọi IP mà host phân giải ra.

    Trả về URL đã chuẩn hoá, hoặc ném ``UnsafeUrl`` với thông điệp an toàn.
    """
    if not raw_url or not raw_url.strip():
        raise UnsafeUrl("URL trống.")

    parsed = urlparse(raw_url.strip())
    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        raise UnsafeUrl("Chỉ hỗ trợ đường dẫn http hoặc https.")
    if not parsed.hostname:
        raise UnsafeUrl("URL không có tên miền hợp lệ.")

    port = parsed.port or (443 if parsed.scheme.lower() == "https" else 80)
    for ip in _resolve(parsed.hostname, port):
        if _is_blocked_ip(ip):
            raise UnsafeUrl(
                "URL trỏ tới một địa chỉ nội bộ. Chỉ nhận đường dẫn báo công khai."
            )

    return urlunparse(parsed)


def safe_get(
    raw_url: str,
    timeout: int = DEFAULT_TIMEOUT,
    max_bytes: int = 2 * 1024 * 1024,
    extra_headers: Optional[dict] = None,
) -> Tuple[str, str]:
    """Tải một trang sau khi đã kiểm tra an toàn ở mọi chặng redirect.

    Trả về ``(text, final_url)``. Ném ``UnsafeUrl`` cho mọi trường hợp bị chặn
    và cho mọi lỗi mạng — thông điệp luôn chung chung, không lộ chi tiết
    upstream.
    """
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8"}
    if extra_headers:
        headers.update(extra_headers)

    url = validate_url(raw_url)

    for _ in range(MAX_REDIRECTS + 1):
        try:
            response = requests.get(
                url,
                headers=headers,
                timeout=timeout,
                allow_redirects=False,
                stream=True,
            )
        except requests.RequestException as exc:
            raise UnsafeUrl("Không tải được nội dung từ URL này.") from exc

        if response.is_redirect or response.status_code in (301, 302, 303, 307, 308):
            location = response.headers.get("Location")
            response.close()
            if not location:
                raise UnsafeUrl("Trang chuyển hướng nhưng không cho biết đích đến.")
            url = validate_url(requests.compat.urljoin(url, location))
            continue

        if response.status_code >= 400:
            response.close()
            raise UnsafeUrl(f"Trang trả về mã lỗi {response.status_code}.")

        content_type = (response.headers.get("Content-Type") or "").lower()
        if content_type and "html" not in content_type and "text" not in content_type:
            response.close()
            raise UnsafeUrl("URL này không trỏ tới một trang HTML.")

        chunks, total = [], 0
        try:
            for chunk in response.iter_content(chunk_size=16384):
                total += len(chunk)
                if total > max_bytes:
                    raise UnsafeUrl("Nội dung tại URL này quá lớn.")
                chunks.append(chunk)
        finally:
            response.close()

        raw = b"".join(chunks)
        encoding = response.encoding or response.apparent_encoding or "utf-8"
        return raw.decode(encoding, errors="replace"), url

    raise UnsafeUrl("URL chuyển hướng quá nhiều lần.")
