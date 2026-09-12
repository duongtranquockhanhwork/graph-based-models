from sqlalchemy import Column, Integer, String, DateTime, Date, Boolean, Text
from sqlalchemy.sql import func
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    # Không còn NOT NULL: tài khoản chỉ đăng ký bằng số điện thoại không có
    # email. Xem migrate.py để biết cách cột này được nới lỏng trên DB cũ.
    email = Column(String(255), unique=True, index=True, nullable=True)
    email_verified = Column(Boolean, nullable=False, default=False)
    full_name = Column(String(255), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    hashed_password = Column(String(255), nullable=True)
    phone = Column(String(20), unique=True, index=True, nullable=True)
    phone_verified = Column(Boolean, nullable=False, default=False)
    firebase_uid = Column(String(128), unique=True, index=True, nullable=True)
    # Text, không phải String(500): avatar lưu thẳng dưới dạng data URI
    # (base64), không phải URL trỏ ra ngoài — xem lý do ở ProfileEditForm.tsx.
    avatar_url = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    role = Column(String(20), nullable=False, default="customer")
    # Tăng lên mỗi khi mật khẩu đổi. JWT mang theo giá trị tại lúc phát
    # hành, nên mọi token cũ hết hiệu lực ngay khi người dùng đổi mật khẩu.
    token_version = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    @property
    def profile_complete(self) -> bool:
        # Đăng ký giờ bắt buộc: họ tên + ngày sinh + mật khẩu, và xác thực OTP
        # qua ít nhất một kênh (SĐT hoặc email). Tài khoản cũ thiếu bất kỳ
        # điều kiện nào bị chặn ở ProtectedRoute cho tới khi hoàn tất
        # /complete-profile.
        return bool(self.full_name and self.date_of_birth and (self.phone_verified or self.email_verified))
