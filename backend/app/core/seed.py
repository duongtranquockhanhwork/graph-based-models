from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.event_keyword import EventKeyword
from app.models.system_setting import SystemSetting
from app.models.user import User
from app.services.nlp_service import EVENT_LABELS_VI, EVENT_PATTERNS

DEFAULT_PASSWORD = "Test@123"

SAMPLE_ACCOUNTS = [
    ("admin@finnexus.dev", "Admin FinNexus", "admin"),
    ("test1@finnexus.dev", "Test User 1", "customer"),
    ("test2@finnexus.dev", "Test User 2", "customer"),
]

DEFAULT_SETTINGS = [
    ("sentiment_positive_threshold", "0.6", "Ngưỡng tỉ lệ từ khóa tích cực để phân loại Positive"),
    ("sentiment_negative_threshold", "0.4", "Ngưỡng tỉ lệ từ khóa tích cực để phân loại Negative (dưới ngưỡng này)"),
    ("manual_review_confidence_threshold", "0.6", "Độ tin cậy dự đoán dưới ngưỡng này sẽ được đưa vào hàng chờ gán nhãn thủ công"),
]


def seed_test_accounts(db: Session) -> None:
    for email, full_name, role in SAMPLE_ACCOUNTS:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            user = User(
                email=email,
                full_name=full_name,
                hashed_password=hash_password(DEFAULT_PASSWORD),
                role=role,
            )
            db.add(user)
        elif user.role != role:
            user.role = role
    db.commit()


def seed_event_keywords(db: Session) -> None:
    if db.query(EventKeyword).first() is not None:
        return
    for event_type, keywords in EVENT_PATTERNS.items():
        label_vi = EVENT_LABELS_VI.get(event_type, event_type)
        for kw in keywords:
            db.add(EventKeyword(event_type=event_type, label_vi=label_vi, keyword=kw, is_active=True))
    db.commit()


def seed_system_settings(db: Session) -> None:
    if db.query(SystemSetting).first() is not None:
        return
    for key, value, description in DEFAULT_SETTINGS:
        db.add(SystemSetting(key=key, value=value, description=description))
    db.commit()


def seed_all(db: Session) -> None:
    seed_test_accounts(db)
    seed_event_keywords(db)
    seed_system_settings(db)
