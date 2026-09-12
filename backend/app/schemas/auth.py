from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.security import MIN_PASSWORD_LENGTH


def _validate_dob(value: Optional[date]) -> Optional[date]:
    if value is not None and value > date.today():
        raise ValueError("Ngày sinh không được vượt quá ngày hiện tại")
    return value


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class PhoneLoginRequest(BaseModel):
    phone: str
    password: str


class PhoneVerifyRequest(BaseModel):
    id_token: str
    # Bắt buộc (và chỉ được dùng) khi token này tạo tài khoản MỚI — nếu số
    # điện thoại đã gắn với một user, ba trường này bị bỏ qua (chỉ dùng để
    # đăng nhập lại qua OTP).
    full_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    password: Optional[str] = None

    _dob = field_validator("date_of_birth")(_validate_dob)


class EmailOtpRequest(BaseModel):
    email: EmailStr


class EmailOtpVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
    # Bắt buộc (và chỉ được dùng) khi mã này tạo tài khoản MỚI — nếu email đã
    # gắn với một user, ba trường này bị bỏ qua (chỉ dùng để đăng nhập lại
    # qua OTP).
    full_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    password: Optional[str] = None

    _dob = field_validator("date_of_birth")(_validate_dob)


class UserOut(BaseModel):
    id: int
    email: Optional[EmailStr] = None
    email_verified: bool = False
    full_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    phone: Optional[str] = None
    phone_verified: bool = False
    profile_complete: bool = False
    avatar_url: Optional[str] = None
    role: str = "customer"
    is_active: bool = True
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=MIN_PASSWORD_LENGTH)


_MAX_AVATAR_DATA_URI_LENGTH = 400_000  # ~290KB ảnh sau mã hoá base64


def _validate_avatar_url(value: Optional[str]) -> Optional[str]:
    # None: không đổi avatar. "": xoá avatar. Còn lại phải là data URI ảnh —
    # ảnh được nén/resize ở phía client (ProfileEditForm.tsx) trước khi gửi
    # lên, không lưu URL trỏ ra ngoài (không có nơi lưu file trong hệ thống).
    if value is None or value == "":
        return value
    if not value.startswith("data:image/"):
        raise ValueError("Ảnh đại diện phải được tải lên trực tiếp, không dùng URL ngoài")
    if len(value) > _MAX_AVATAR_DATA_URI_LENGTH:
        raise ValueError("Ảnh đại diện quá lớn, hãy chọn ảnh nhỏ hơn")
    return value


class UpdateProfileRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    date_of_birth: Optional[date] = None
    avatar_url: Optional[str] = None

    _dob = field_validator("date_of_birth")(_validate_dob)
    _avatar = field_validator("avatar_url")(_validate_avatar_url)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=MIN_PASSWORD_LENGTH)
