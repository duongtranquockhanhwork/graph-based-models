from sqlalchemy.orm import Session

from app.models.activity_log import AdminActivityLog
from app.models.user import User


def log_activity(db: Session, actor: User, action: str, detail: str = "", status: str = "success") -> None:
    db.add(
        AdminActivityLog(
            actor_user_id=actor.id,
            actor_name=actor.full_name or actor.email,
            action=action,
            detail=detail,
            status=status,
        )
    )
    db.commit()
