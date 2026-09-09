import os

from pydantic_settings import BaseSettings

# Chỉ dùng cho môi trường phát triển. Production bắt buộc phải đặt
# JWT_SECRET_KEY thật (xem Settings.validate_for_environment bên dưới) —
# secret mặc định nằm công khai trong repo nên mọi token đều giả mạo được.
DEV_JWT_SECRET = "dev-secret-change-me"


class Settings(BaseSettings):
    # "development" | "production". Quyết định: có seed tài khoản test không,
    # có mở /docs không, có cho phép JWT secret mặc định không.
    ENVIRONMENT: str = "development"

    DATABASE_URL: str = "postgresql://finnexus:finnexus123@postgres:5432/finnexus_db"

    # Auth
    JWT_SECRET_KEY: str = DEV_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    GOOGLE_CLIENT_ID: str = ""

    # Email (password reset)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "no-reply@finnexus.local"
    FRONTEND_URL: str = "http://localhost:3000"

    # Mô hình FinNexus KG (repo nghiên cứu). Trỏ tới thư mục gốc chứa
    # config/inference_article_scoring_v1.yaml và outputs/model_experiments/.
    # Để trống -> hệ thống chạy với bộ luật heuristic và nói rõ điều đó
    # trên /api/prediction/model-info thay vì giả vờ có mô hình.
    FINNEXUS_ROOT: str = ""
    FINNEXUS_CONFIG: str = "config/inference_article_scoring_v1.yaml"

    # Giới hạn nhập liệu — chặn DoS qua upload và qua import URL.
    MAX_CSV_BYTES: int = 5 * 1024 * 1024
    MAX_CSV_ROWS: int = 2000
    MAX_FETCH_BYTES: int = 2 * 1024 * 1024

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() == "production"

    def validate_for_environment(self) -> None:
        """Từ chối khởi động với cấu hình không an toàn thay vì chạy rồi
        âm thầm phục vụ bằng secret mặc định ai cũng biết."""
        if not self.is_production:
            return
        if self.JWT_SECRET_KEY == DEV_JWT_SECRET or len(self.JWT_SECRET_KEY) < 32:
            raise RuntimeError(
                "ENVIRONMENT=production nhưng JWT_SECRET_KEY còn là giá trị mặc định "
                "hoặc quá ngắn. Sinh secret: python -c \"import secrets; "
                "print(secrets.token_hex(32))\""
            )

    class Config:
        env_file = ".env"


settings = Settings()
settings.validate_for_environment()

# Cho phép test ghi đè mà không cần biến môi trường.
if os.getenv("FINNEXUS_ROOT"):
    settings.FINNEXUS_ROOT = os.environ["FINNEXUS_ROOT"]
