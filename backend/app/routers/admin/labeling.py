from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.news import NewsArticle
from app.models.user import User
from app.schemas.admin import NewsLabelSubmit
from app.schemas.schemas import NewsResponse
from app.services.activity_log import log_activity

router = APIRouter()


@router.get("/queue", response_model=list[NewsResponse])
def labeling_queue(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return (
        db.query(NewsArticle)
        .filter(NewsArticle.needs_manual_label == True)  # noqa: E712
        .order_by(NewsArticle.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.post("/{news_id}", response_model=NewsResponse)
def submit_label(
    news_id: int,
    payload: NewsLabelSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = db.query(NewsArticle).filter(NewsArticle.id == news_id).first()
    if not n:
        raise HTTPException(404, "Không tìm thấy tin tức")

    n.manual_sentiment = payload.manual_sentiment
    n.manual_event_type = payload.manual_event_type
    n.needs_manual_label = False
    n.labeled_by_id = current_user.id
    n.labeled_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(n)

    log_activity(
        db,
        current_user,
        "Gán nhãn thủ công",
        f"Tin #{news_id}: sentiment={payload.manual_sentiment}, event={payload.manual_event_type}",
    )
    return n
