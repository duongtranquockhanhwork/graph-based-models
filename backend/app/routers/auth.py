from fastapi import APIRouter, Depends, HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.email import send_reset_email
from app.core.security import (
    create_access_token,
    create_reset_token,
    hash_password,
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
    return TokenResponse(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.post("/register", response_model=TokenResponse)
def register(payload: UserCreate, db: Session = Depends(get_db)):
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


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.hashed_password or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(401, "Email hoặc mật khẩu không đúng")
    return _token_response(user)


@router.post("/google", response_model=TokenResponse)
def google_login(payload: GoogleLoginRequest, db: Session = Depends(get_db)):
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(500, "Google login chưa được cấu hình")

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


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.hashed_password:
        raise HTTPException(400, "Tài khoản đăng nhập bằng Google chưa có mật khẩu. Dùng Quên mật khẩu để đặt mật khẩu mới.")
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(400, "Mật khẩu hiện tại không đúng")

    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Đổi mật khẩu thành công"}


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if user:
        token = create_reset_token(user.email)
        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        send_reset_email(user.email, reset_link)
    return {"message": "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi"}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    email = verify_reset_token(payload.token)
    if not email:
        raise HTTPException(400, "Token không hợp lệ hoặc đã hết hạn")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(400, "Token không hợp lệ hoặc đã hết hạn")

    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Đặt lại mật khẩu thành công"}
