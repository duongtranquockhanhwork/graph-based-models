from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import auth as firebase_auth
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.email import send_otp_email, send_reset_email
from app.core.email_otp import issue_code as issue_email_otp
from app.core.email_otp import verify_code as verify_email_otp
from app.core.firebase import get_firebase_app
from app.core.ratelimit import (
    email_otp_request_limit,
    email_otp_verify_limit,
    forgot_password_limit,
    login_limit,
    phone_verify_limit,
)
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
    EmailOtpRequest,
    EmailOtpVerifyRequest,
    ForgotPasswordRequest,
    PhoneLoginRequest,
    PhoneVerifyRequest,
    ResetPasswordRequest,
    TokenResponse,
    UpdateProfileRequest,
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


def _require_registration_fields(full_name: str | None, date_of_birth, password: str | None) -> None:
    # Đăng ký bắt buộc họ tên + ngày sinh + mật khẩu ngay từ đầu — không được
    # tạo tài khoản chỉ bằng SĐT/email trần rồi để trống phần còn lại.
    if not full_name or not date_of_birth:
        raise HTTPException(400, "Cần nhập họ tên và ngày sinh để tạo tài khoản mới")
    if not password:
        raise HTTPException(400, "Cần đặt mật khẩu để tạo tài khoản mới")
    _check_password(password)


def _verify_firebase_token(id_token: str) -> dict:
    app = get_firebase_app()
    if app is None:
        raise HTTPException(503, "Đăng nhập bằng số điện thoại chưa được cấu hình trên máy chủ này")
    try:
        return firebase_auth.verify_id_token(id_token, app=app)
    except Exception:
        raise HTTPException(401, "Mã OTP không hợp lệ hoặc đã hết hạn")


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(login_limit)])
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.hashed_password or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(401, "Email hoặc mật khẩu không đúng")
    if not user.is_active:
        raise HTTPException(403, "Tài khoản đã bị khoá")
    return _token_response(user)


@router.post("/login-phone", response_model=TokenResponse, dependencies=[Depends(login_limit)])
def login_phone(payload: PhoneLoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone == payload.phone).first()
    if not user or not user.hashed_password or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(401, "Số điện thoại hoặc mật khẩu không đúng")
    if not user.is_active:
        raise HTTPException(403, "Tài khoản đã bị khoá")
    return _token_response(user)


@router.post("/firebase-phone", response_model=TokenResponse, dependencies=[Depends(phone_verify_limit)])
def firebase_phone_login(payload: PhoneVerifyRequest, db: Session = Depends(get_db)):
    decoded = _verify_firebase_token(payload.id_token)

    phone = decoded.get("phone_number")
    firebase_uid = decoded.get("uid")
    if not phone or not firebase_uid:
        raise HTTPException(401, "Token thiếu số điện thoại")

    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    if not user:
        user = db.query(User).filter(User.phone == phone).first()

    if not user:
        # Số điện thoại này chưa gắn tài khoản nào -> coi đây là đăng ký mới.
        _require_registration_fields(payload.full_name, payload.date_of_birth, payload.password)
        user = User(
            phone=phone,
            firebase_uid=firebase_uid,
            phone_verified=True,
            full_name=payload.full_name,
            date_of_birth=payload.date_of_birth,
            hashed_password=hash_password(payload.password),
        )
        db.add(user)
    else:
        if not user.is_active:
            raise HTTPException(403, "Tài khoản đã bị khoá")
        if not user.firebase_uid:
            user.firebase_uid = firebase_uid
        user.phone_verified = True

    db.commit()
    db.refresh(user)
    return _token_response(user)


@router.post("/link-phone", response_model=UserOut, dependencies=[Depends(phone_verify_limit)])
def link_phone(
    payload: PhoneVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Gắn SĐT đã xác thực OTP vào tài khoản ĐANG đăng nhập.

    Dùng cho tài khoản cũ (thiếu xác thực) hoàn tất bước bắt buộc ở
    /complete-profile — khác /firebase-phone ở chỗ nó không bao giờ tạo user
    mới, chỉ gắn thêm vào current_user.
    """
    decoded = _verify_firebase_token(payload.id_token)
    phone = decoded.get("phone_number")
    firebase_uid = decoded.get("uid")
    if not phone or not firebase_uid:
        raise HTTPException(401, "Token thiếu số điện thoại")

    existing = db.query(User).filter(User.phone == phone, User.id != current_user.id).first()
    if existing:
        raise HTTPException(400, "Số điện thoại này đã được liên kết với một tài khoản khác")

    current_user.phone = phone
    current_user.firebase_uid = firebase_uid
    current_user.phone_verified = True
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/email-otp/request", dependencies=[Depends(email_otp_request_limit)])
def request_email_otp(payload: EmailOtpRequest):
    code = issue_email_otp(payload.email)
    send_otp_email(payload.email, code)
    # Thông điệp không tiết lộ email có tồn tại tài khoản hay không — hành vi
    # giống nhau dù đây là đăng ký mới hay đăng nhập lại.
    return {"message": "Mã xác thực đã được gửi tới email của bạn"}


@router.post("/email-otp/verify", response_model=TokenResponse, dependencies=[Depends(email_otp_verify_limit)])
def verify_email_otp_route(payload: EmailOtpVerifyRequest, db: Session = Depends(get_db)):
    if not verify_email_otp(payload.email, payload.code):
        raise HTTPException(401, "Mã OTP không đúng hoặc đã hết hạn")

    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        # Email này chưa gắn tài khoản nào -> coi đây là đăng ký mới.
        _require_registration_fields(payload.full_name, payload.date_of_birth, payload.password)
        user = User(
            email=payload.email,
            email_verified=True,
            full_name=payload.full_name,
            date_of_birth=payload.date_of_birth,
            hashed_password=hash_password(payload.password),
        )
        db.add(user)
    else:
        if not user.is_active:
            raise HTTPException(403, "Tài khoản đã bị khoá")
        user.email_verified = True

    db.commit()
    db.refresh(user)
    return _token_response(user)


@router.post("/link-email", response_model=UserOut, dependencies=[Depends(email_otp_verify_limit)])
def link_email(
    payload: EmailOtpVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Gắn email đã xác thực OTP vào tài khoản ĐANG đăng nhập — mirror của
    /link-phone, dùng ở /complete-profile cho tài khoản cũ thiếu xác thực."""
    if not verify_email_otp(payload.email, payload.code):
        raise HTTPException(401, "Mã OTP không đúng hoặc đã hết hạn")

    existing = db.query(User).filter(User.email == payload.email, User.id != current_user.id).first()
    if existing:
        raise HTTPException(400, "Email này đã được liên kết với một tài khoản khác")

    current_user.email = payload.email
    current_user.email_verified = True
    db.commit()
    db.refresh(current_user)
    return current_user


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
    if payload.date_of_birth is not None:
        current_user.date_of_birth = payload.date_of_birth
    if payload.avatar_url is not None:
        # "" xoá avatar (về lại chữ cái đầu tên); chuỗi khác thì đã được
        # _validate_avatar_url xác nhận là data URI ảnh hợp lệ.
        current_user.avatar_url = payload.avatar_url or None
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
            "Tài khoản này chưa có mật khẩu. Dùng Quên mật khẩu để đặt mật khẩu mới.",
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
