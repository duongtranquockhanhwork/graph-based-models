from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


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
    new_password: str = Field(min_length=10)


class UpdateProfileRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    date_of_birth: Optional[date] = None

    _dob = field_validator("date_of_birth")(_validate_dob)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=10)
