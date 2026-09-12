from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

RESET_TOKEN_EXPIRE_MINUTES = 30
MIN_PASSWORD_LENGTH = 8

# Mật khẩu bị từ chối bất kể độ dài. Danh sách ngắn cố ý: nó chặn những giá trị
# xuất hiện trong mọi bộ từ điển tấn công, không thay thế cho việc kiểm tra
# entropy nếu sau này cần siết thêm.
COMMON_PASSWORDS = {
    "password", "password1", "password123", "12345678", "123456789", "1234567890",
    "qwertyuiop", "1q2w3e4r5t", "iloveyou", "admin123", "matkhau123", "abcd1234",
    "11111111", "00000000", "letmein123", "welcome123", "passw0rd", "p@ssw0rd",
}


class WeakPassword(ValueError):
    """Mật khẩu không đạt chính sách. Thông điệp nói rõ thiếu điều gì."""


def validate_password_strength(password: str) -> None:
    """Bản trước chỉ yêu cầu 6 ký tự, nên "password" và "123456" đều qua.

    Yêu cầu hiện tại: tối thiểu 8 ký tự, có đủ cả 4 loại — chữ hoa, chữ
    thường, số, ký tự đặc biệt — và không nằm trong danh sách mật khẩu phổ
    biến đã bị lộ.
    """
    if len(password) < MIN_PASSWORD_LENGTH:
        raise WeakPassword(f"Mật khẩu phải có ít nhất {MIN_PASSWORD_LENGTH} ký tự.")
    if password.lower() in COMMON_PASSWORDS:
        raise WeakPassword("Mật khẩu này nằm trong danh sách bị lộ phổ biến, hãy chọn mật khẩu khác.")
    missing = []
    if not any(c.islower() for c in password):
        missing.append("chữ thường")
    if not any(c.isupper() for c in password):
        missing.append("chữ hoa")
    if not any(c.isdigit() for c in password):
        missing.append("số")
    if not any(not c.isalnum() for c in password):
        missing.append("ký tự đặc biệt")
    if missing:
        raise WeakPassword(f"Mật khẩu còn thiếu: {', '.join(missing)}.")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def _create_token(data: dict, expires_delta: timedelta) -> str:
    to_encode = data.copy()
    to_encode["exp"] = datetime.now(timezone.utc) + expires_delta
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: int, token_version: int = 0) -> str:
    """``ver`` được đối chiếu với ``users.token_version`` ở mỗi request.

    Nhờ đó đổi mật khẩu thu hồi được mọi phiên cũ. Trước đây token sống đủ 7
    ngày kể cả sau khi người dùng đổi mật khẩu vì nghi bị xâm nhập.
    """
    return _create_token(
        {"sub": str(user_id), "scope": "access", "ver": int(token_version)},
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_reset_token(email: str, token_version: int = 0) -> str:
    """Token reset cũng mang ``ver``.

    Reset mật khẩu làm tăng ``token_version``, nên token reset chỉ dùng được
    MỘT lần: lần thứ hai ``ver`` không còn khớp. Trước đây cùng một link reset
    dùng lại được suốt 30 phút, nên link bị lộ cho phép chiếm tài khoản lặp lại.
    """
    return _create_token(
        {"sub": email, "scope": "reset", "ver": int(token_version)},
        timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES),
    )


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None


def verify_reset_token(token: str) -> tuple[str, int] | None:
    """Trả về ``(email, token_version)`` hoặc ``None`` nếu token không hợp lệ."""
    payload = decode_token(token)
    if not payload or payload.get("scope") != "reset":
        return None
    email = payload.get("sub")
    if not email:
        return None
    return email, int(payload.get("ver", 0))
