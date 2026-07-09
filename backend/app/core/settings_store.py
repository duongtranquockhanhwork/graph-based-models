from sqlalchemy.orm import Session

from app.models.system_setting import SystemSetting


def get_setting(db: Session, key: str, default: str) -> str:
    row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    return row.value if row else default


def get_float_setting(db: Session, key: str, default: float) -> float:
    value = get_setting(db, key, str(default))
    try:
        return float(value)
    except (TypeError, ValueError):
        return default
