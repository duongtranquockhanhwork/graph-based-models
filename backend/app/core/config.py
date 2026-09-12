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

    # SQLite trong thư mục backend/ là mặc định, vì đó là thứ chạy được ở MỌI
    # nơi mà không cần cài gì thêm — đúng như README hướng dẫn.
    #
    # Mặc định cũ là "postgresql://finnexus:finnexus123@postgres:5432/..." và
    # nó hỏng theo hai cách: "postgres" là tên service chỉ phân giải được BÊN
    # TRONG mạng Docker, nên ai clone về rồi làm theo README sẽ nhận
    # "could not translate host name" ngay ở lệnh khởi động đầu tiên; và một
    # mật khẩu thật nằm sẵn trong mã nguồn là thứ dễ bị dùng lại nguyên trạng
    # khi triển khai.
    #
    # Docker Compose vẫn dùng PostgreSQL: nó truyền DATABASE_URL qua biến môi
    # trường, và biến môi trường luôn thắng giá trị mặc định ở đây.
    DATABASE_URL: str = "sqlite:///./dev.db"

    # Auth
    JWT_SECRET_KEY: str = DEV_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # Xác thực số điện thoại qua Firebase (tuỳ chọn). Để trống FIREBASE_PROJECT_ID
    # thì tính năng tự tắt — /auth/firebase-phone và /auth/link-phone trả 503.
    # FIREBASE_CREDENTIALS_JSON là đường dẫn tới file service-account JSON; để
    # trống thì dùng Application Default Credentials (phù hợp khi chạy trên GCP).
    FIREBASE_PROJECT_ID: str = ""
    FIREBASE_CREDENTIALS_JSON: str = ""

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
    # Tự tải các phiên giá còn thiếu (qua vnstock) khi một bài mới cần giá gần
    # hơn bảng giá đang có, rồi chấm lại. Tắt đi thì bài đó bị từ chối kèm lý
    # do rõ ràng — không bao giờ bị chấm trên giá cũ.
    FINNEXUS_LIVE_PRICES: bool = True

    # Claude giải thích bài báo (tuỳ chọn). Để trống khoá thì tính năng tự tắt;
    # SDK cũng tự đọc ANTHROPIC_API_KEY từ biến môi trường, nhưng khai báo ở đây
    # để khoá đặt trong file .env cũng dùng được — pydantic-settings nạp .env vào
    # Settings chứ không vào os.environ.
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-opus-5"
    AI_ANALYSIS_TIMEOUT: float = 120.0

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

# Biến môi trường thắng file .env, và "đặt thành rỗng" là một lựa chọn có ý,
# khác với "không đặt gì". Bộ test dựa vào đúng khác biệt này: nó đặt rỗng để
# chạy trong tình huống không có mô hình, và không được để phần tự dò bên dưới
# lặng lẽ bật mô hình lên lại.
if "FINNEXUS_ROOT" in os.environ:
    settings.FINNEXUS_ROOT = os.environ["FINNEXUS_ROOT"]
elif not settings.FINNEXUS_ROOT.strip():
    # Bản demo đóng gói sẵn mô hình ở <gốc kho>/model, nên clone về là chạy
    # được ngay mà không phải cấu hình gì.
    _bundled = os.path.join(os.path.dirname(__file__), "..", "..", "..", "model")
    if os.path.isdir(os.path.join(_bundled, "config")):
        settings.FINNEXUS_ROOT = os.path.abspath(_bundled)
