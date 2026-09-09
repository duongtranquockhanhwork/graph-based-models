from fastapi import APIRouter, Depends, HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.email import send_reset_email
from app.core.ratelimit import forgot_password_limit, login_limit, register_limit
from app.core.security import (
    WeakPassword,
    create_access_token,
    create_reset_token,
    hash_password,
    validate_password_strength,
    verify_password,
    verify_reset_token,
)
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    GoogleLoginRequest,
    ResetPasswordRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserCreate,
    UserLogin,
    UserOut,
)

router = APIRouter()


def _token_response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id, user.token_version or 0),
        user=UserOut.model_validate(user),
    )


def _check_password(password: str) -> None:
    try:
        validate_password_strength(password)
    except WeakPassword as exc:
        raise HTTPException(400, str(exc))


@router.post("/register", response_model=TokenResponse, dependencies=[Depends(register_limit)])
def register(payload: UserCreate, db: Session = Depends(get_db)):
    _check_password(payload.password)

    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(400, "Email đã được sử dụng")

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _token_response(user)


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(login_limit)])
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.hashed_password or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(401, "Email hoặc mật khẩu không đúng")
    if not user.is_active:
        raise HTTPException(403, "Tài khoản đã bị khoá")
    return _token_response(user)


@router.post("/google", response_model=TokenResponse, dependencies=[Depends(login_limit)])
def google_login(payload: GoogleLoginRequest, db: Session = Depends(get_db)):
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(503, "Đăng nhập Google chưa được cấu hình trên máy chủ này")

    try:
        idinfo = google_id_token.verify_oauth2_token(
            payload.id_token, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
    except ValueError:
        raise HTTPException(401, "Google token không hợp lệ")

    email = idinfo.get("email")
    google_id = idinfo.get("sub")
    if not email or not google_id:
        raise HTTPException(401, "Google token thiếu thông tin cần thiết")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            full_name=idinfo.get("name"),
            google_id=google_id,
            avatar_url=idinfo.get("picture"),
        )
        db.add(user)
    else:
        if not user.is_active:
            raise HTTPException(403, "Tài khoản đã bị khoá")
        if not user.google_id:
            user.google_id = google_id
        if not user.avatar_url and idinfo.get("picture"):
            user.avatar_url = idinfo.get("picture")

    db.commit()
    db.refresh(user)
    return _token_response(user)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.full_name = payload.full_name
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password", response_model=TokenResponse)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.hashed_password:
        raise HTTPException(
            400,
            "Tài khoản đăng nhập bằng Google chưa có mật khẩu. Dùng Quên mật khẩu để đặt mật khẩu mới.",
        )
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(400, "Mật khẩu hiện tại không đúng")
    _check_password(payload.new_password)

    current_user.hashed_password = hash_password(payload.new_password)
    # Thu hồi mọi phiên cũ. Người dùng đổi mật khẩu vì nghi bị xâm nhập phải
    # thực sự đẩy được kẻ tấn công ra, chứ không để token cũ sống thêm 7 ngày.
    current_user.token_version = (current_user.token_version or 0) + 1
    db.commit()
    db.refresh(current_user)

    # Trả token mới để chính người vừa đổi mật khẩu không bị đăng xuất.
    return _token_response(current_user)


@router.post("/forgot-password", dependencies=[Depends(forgot_password_limit)])
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if user:
        token = create_reset_token(user.email, user.token_version or 0)
        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        send_reset_email(user.email, reset_link)
    # Thông điệp giống nhau dù email có tồn tại hay không, để không dò được
    # danh sách người dùng.
    return {"message": "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi"}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    verified = verify_reset_token(payload.token)
    if not verified:
        raise HTTPException(400, "Token không hợp lệ hoặc đã hết hạn")
    email, token_version = verified

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(400, "Token không hợp lệ hoặc đã hết hạn")

    # Token mang theo token_version tại lúc phát hành. Lần reset đầu tiên tăng
    # giá trị này lên, nên lần thứ hai với cùng link sẽ không khớp và bị từ
    # chối — link reset dùng đúng một lần.
    if token_version != int(user.token_version or 0):
        raise HTTPException(400, "Token này đã được sử dụng hoặc không còn hiệu lực")

    _check_password(payload.new_password)

    user.hashed_password = hash_password(payload.new_password)
    user.token_version = int(user.token_version or 0) + 1
    db.commit()
    return {"message": "Đặt lại mật khẩu thành công"}
