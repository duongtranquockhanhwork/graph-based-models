from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Không thể xác thực thông tin đăng nhập",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception

    payload = decode_token(token)
    if not payload or payload.get("scope") != "access":
        raise credentials_exception

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    try:
        user = db.query(User).filter(User.id == int(user_id)).first()
    except (TypeError, ValueError):
        raise credentials_exception

    if not user or not user.is_active:
        raise credentials_exception

    # Đối chiếu phiên bản token. Đổi/đặt lại mật khẩu làm tăng token_version,
    # nên mọi token phát hành trước đó ngừng hiệu lực ngay lập tức thay vì
    # sống hết 7 ngày.
    if int(payload.get("ver", 0)) != int(user.token_version or 0):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên đăng nhập đã hết hiệu lực do mật khẩu vừa thay đổi. Vui lòng đăng nhập lại.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yêu cầu quyền quản trị viên")
    return current_user


def owner_scope(current_user: User) -> int | None:
    """Mỗi khách hàng chỉ thấy dữ liệu (tin tức, đồ thị, thống kê, dự đoán)
    do chính họ thêm vào; admin thấy toàn hệ thống gộp lại.

    ``None`` nghĩa là "không lọc theo chủ sở hữu" (admin). Nơi gọi truyền
    thẳng kết quả này vào tham số ``owner_id`` của các hàm ở tầng service —
    ``NewsArticle.owner_id == owner_id`` khi có giá trị, bỏ qua khi None.
    """
    return None if current_user.role == "admin" else current_user.id
