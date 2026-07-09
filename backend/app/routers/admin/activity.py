from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.activity_log import AdminActivityLog

router = APIRouter()


@router.get("/")
def list_activity(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    rows = (
        db.query(AdminActivityLog)
        .order_by(AdminActivityLog.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": a.id,
            "actor_name": a.actor_name,
            "action": a.action,
            "detail": a.detail,
            "status": a.status,
            "created_at": a.created_at,
        }
        for a in rows
    ]
