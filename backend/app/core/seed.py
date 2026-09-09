"""Dữ liệu khởi tạo.

Phân biệt rõ hai loại, vì gộp chung là lỗ hổng nghiêm trọng nhất của bản trước:

* **Cấu hình hệ thống và từ khoá sự kiện** — cần cho hệ thống hoạt động, seed
  ở mọi môi trường.
* **Tài khoản test** — CHỈ seed khi ``ENVIRONMENT`` không phải production.

Bản trước tạo ``admin@finnexus.dev`` với mật khẩu ``Test@123`` trên mọi lần
khởi động ở mọi môi trường, và ghi cặp thông tin đó trong README. Xoá tài khoản
đi thì lần restart sau nó quay lại. Bất kỳ ai đọc repo đều có quyền quản trị.
"""

import logging

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.event_keyword import EventKeyword
from app.models.system_setting import SystemSetting
from app.models.user import User
from app.services.nlp_service import EVENT_LABELS_VI, EVENT_PATTERNS

logger = logging.getLogger("finnexus.seed")

DEV_PASSWORD = "Test@123456"

DEV_ACCOUNTS = [
    ("admin@finnexus.dev", "Admin FinNexus", "admin"),
    ("test1@finnexus.dev", "Test User 1", "customer"),
    ("test2@finnexus.dev", "Test User 2", "customer"),
]

DEFAULT_SETTINGS = [
    ("sentiment_positive_threshold", "0.6", "Ngưỡng tỉ lệ từ khóa tích cực để phân loại Positive"),
    ("sentiment_negative_threshold", "0.4", "Ngưỡng tỉ lệ từ khóa tích cực để phân loại Negative (dưới ngưỡng này)"),
    (
        "manual_review_confidence_threshold",
        "0.45",
        "Độ tin cậy dự đoán dưới ngưỡng này sẽ được đưa vào hàng chờ gán nhãn thủ công. "
        "Đặt sát ngưỡng vận hành của mô hình (0.4425) để hàng chờ chỉ nhận ca thật sự khó, "
        "thay vì nhận toàn bộ bài báo như khi ngưỡng cao hơn mọi độ tin cậy mà mô hình sinh ra.",
    ),
]


def seed_dev_accounts(db: Session) -> None:
    if settings.is_production:
        logger.info("ENVIRONMENT=production: bỏ qua seed tài khoản test.")
        return

    for email, full_name, role in DEV_ACCOUNTS:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            db.add(
                User(
                    email=email,
                    full_name=full_name,
                    hashed_password=hash_password(DEV_PASSWORD),
                    role=role,
                )
            )
        elif user.role != role:
            user.role = role
    db.commit()
    logger.warning(
        "Đã seed %d tài khoản phát triển với mật khẩu mặc định. "
        "KHÔNG chạy cấu hình này ngoài môi trường phát triển.",
        len(DEV_ACCOUNTS),
    )


def seed_event_keywords(db: Session) -> None:
    if db.query(EventKeyword).first() is not None:
        return
    for event_type, keywords in EVENT_PATTERNS.items():
        label_vi = EVENT_LABELS_VI.get(event_type, event_type)
        for kw in keywords:
            db.add(EventKeyword(event_type=event_type, label_vi=label_vi, keyword=kw, is_active=True))
    db.commit()


def seed_system_settings(db: Session) -> None:
    existing = {row.key for row in db.query(SystemSetting).all()}
    for key, value, description in DEFAULT_SETTINGS:
        if key not in existing:
            db.add(SystemSetting(key=key, value=value, description=description))
    db.commit()


def seed_all(db: Session) -> None:
    seed_dev_accounts(db)
    seed_event_keywords(db)
    seed_system_settings(db)
