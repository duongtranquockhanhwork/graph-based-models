"""Bổ sung cột và index cho cơ sở dữ liệu đã tồn tại.

``Base.metadata.create_all`` chỉ tạo BẢNG còn thiếu, không tạo CỘT còn thiếu
trên bảng đã có. Các câu lệnh dưới đây lấp khoảng trống đó.

Đây vẫn là giải pháp tạm. Hệ thống này nên dùng Alembic: có version, có
rollback, có lịch sử. Danh sách viết tay ở đây không biết nó đang ở phiên bản
schema nào và không lùi lại được. Xem README mục "Giới hạn đã biết".

Điểm khác so với bản trước: các câu lệnh được viết theo từng dialect thay vì
dùng cú pháp riêng của PostgreSQL rồi nuốt exception. Bản cũ ném và ghi log
traceback cho cả 8 câu lệnh khi chạy trên SQLite, khiến log khởi động lẫn lộn
giữa lỗi thật và lỗi mong đợi.

Giới hạn thêm (nới NOT NULL của users.email): SQLite không hỗ trợ
``ALTER TABLE ... ALTER COLUMN ... DROP NOT NULL`` — muốn làm đúng phải dựng
lại bảng. Bước ``_relax_users_email`` dưới đây vì vậy chỉ chạy trên
PostgreSQL; trên SQLite nó no-op và ghi log cảnh báo. DB SQLite cục bộ vốn là
đồ dùng để vứt (xem chú thích DATABASE_URL trong config.py), nên xoá
``dev.db`` rồi để ``create_all`` dựng lại từ model mới là đủ cho dev.
"""

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

# (bảng, cột, kiểu dữ liệu portable)
_COLUMNS = [
    ("users", "role", "VARCHAR(20) NOT NULL DEFAULT 'customer'"),
    ("users", "token_version", "INTEGER NOT NULL DEFAULT 0"),
    ("users", "date_of_birth", "DATE"),
    ("users", "phone", "VARCHAR(20)"),
    ("users", "phone_verified", "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("users", "email_verified", "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("users", "firebase_uid", "VARCHAR(128)"),
    ("news_articles", "needs_manual_label", "BOOLEAN DEFAULT FALSE"),
    ("news_articles", "manual_sentiment", "VARCHAR(20)"),
    ("news_articles", "manual_event_type", "VARCHAR(50)"),
    ("news_articles", "labeled_by_id", "INTEGER"),
    ("news_articles", "labeled_at", "TIMESTAMP"),
    ("news_articles", "actual_trend", "VARCHAR(20)"),
    ("news_articles", "actual_trend_pct_change", "FLOAT"),
    ("news_articles", "prediction_decision", "VARCHAR(30)"),
    ("news_articles", "ai_analysis", "JSON"),
]

# Các cột này được lọc thường xuyên nhưng trước đây không có index nào.
_INDEXES = [
    ("ix_news_published_date", "news_articles", "published_date"),
    ("ix_news_source", "news_articles", "source"),
    ("ix_news_sentiment", "news_articles", "sentiment"),
    ("ix_news_is_analyzed", "news_articles", "is_analyzed"),
    ("ix_news_needs_manual_label", "news_articles", "needs_manual_label"),
    ("ix_news_actual_trend", "news_articles", "actual_trend"),
    ("ix_watchlist_user", "watchlist_items", "user_id"),
]

# Cột nullable vẫn cần duy nhất khi có giá trị — nhiều NULL thì cả SQLite lẫn
# PostgreSQL đều coi là phân biệt nên không đụng hàng.
_UNIQUE_INDEXES = [
    ("ux_users_phone", "users", "phone"),
    ("ux_users_firebase_uid", "users", "firebase_uid"),
]


def run_migrations(engine: Engine) -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    with engine.connect() as conn:
        for table, column, ddl in _COLUMNS:
            if table not in existing_tables:
                continue
            columns = {c["name"] for c in inspector.get_columns(table)}
            if column in columns:
                continue
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
                conn.commit()
                logger.info("Đã thêm cột %s.%s", table, column)
            except Exception:
                conn.rollback()
                logger.warning("Không thêm được cột %s.%s", table, column, exc_info=True)

        # Inspector cache get_columns() theo instance — nếu dùng lại "inspector"
        # ở trên, các bước dưới đây không thấy được cột vừa ALTER xong trong
        # chính lần chạy này (vd. phone/firebase_uid mới thêm ở loop trên,
        # cần index ngay bên dưới). Lấy inspector mới để đọc đúng trạng thái
        # hiện tại. Điều này cũng vá một lỗi tương tự đã có sẵn: ix_news_* index
        # cho các cột news_articles mới thêm ở loop trên cũng bị bỏ qua.
        inspector = inspect(engine)

        for name, table, column in _INDEXES:
            if table not in existing_tables:
                continue
            columns = {c["name"] for c in inspector.get_columns(table)}
            if column not in columns:
                continue
            try:
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS {name} ON {table} ({column})"))
                conn.commit()
            except Exception:
                conn.rollback()
                logger.warning("Không tạo được index %s", name, exc_info=True)

        for name, table, column in _UNIQUE_INDEXES:
            if table not in existing_tables:
                continue
            columns = {c["name"] for c in inspector.get_columns(table)}
            if column not in columns:
                continue
            try:
                conn.execute(text(f"CREATE UNIQUE INDEX IF NOT EXISTS {name} ON {table} ({column})"))
                conn.commit()
            except Exception:
                conn.rollback()
                logger.warning("Không tạo được unique index %s", name, exc_info=True)

        _relax_users_email(conn, inspector, existing_tables)


def _relax_users_email(conn, inspector, existing_tables: set) -> None:
    """Cho phép users.email = NULL (tài khoản chỉ đăng ký bằng SĐT).

    Chỉ PostgreSQL hỗ trợ DROP NOT NULL qua ALTER COLUMN — xem giới hạn đã
    ghi ở docstring đầu file.
    """
    if "users" not in existing_tables:
        return
    email_column = next((c for c in inspector.get_columns("users") if c["name"] == "email"), None)
    if email_column is None or email_column.get("nullable"):
        return
    if conn.engine.dialect.name != "postgresql":
        logger.warning(
            "Dialect %s không hỗ trợ nới NOT NULL cho users.email qua ALTER. "
            "Xoá DB dev cục bộ để create_all dựng lại từ model mới.",
            conn.engine.dialect.name,
        )
        return
    try:
        conn.execute(text("ALTER TABLE users ALTER COLUMN email DROP NOT NULL"))
        conn.commit()
    except Exception:
        conn.rollback()
        logger.warning("Không nới được NOT NULL cho users.email", exc_info=True)
