from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.event_keyword import EventKeyword
from app.models.user import User
from app.schemas.admin import EventKeywordCreate, EventKeywordOut, EventKeywordUpdate
from app.services.activity_log import log_activity

router = APIRouter()


@router.get("/", response_model=List[EventKeywordOut])
def list_keywords(event_type: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(EventKeyword)
    if event_type:
        query = query.filter(EventKeyword.event_type == event_type)
    return query.order_by(EventKeyword.event_type.asc(), EventKeyword.id.asc()).all()


@router.post("/", response_model=EventKeywordOut)
def create_keyword(
    payload: EventKeywordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    kw = EventKeyword(**payload.model_dump())
    db.add(kw)
    db.commit()
    db.refresh(kw)
    log_activity(db, current_user, "Thêm từ khoá sự kiện", f"{kw.event_type}: '{kw.keyword}'")
    return kw


@router.patch("/{keyword_id}", response_model=EventKeywordOut)
def update_keyword(
    keyword_id: int,
    payload: EventKeywordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    kw = db.query(EventKeyword).filter(EventKeyword.id == keyword_id).first()
    if not kw:
        raise HTTPException(404, "Không tìm thấy từ khoá")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(kw, field, value)
    db.commit()
    db.refresh(kw)
    log_activity(db, current_user, "Cập nhật từ khoá sự kiện", f"#{kw.id} {kw.event_type}: '{kw.keyword}'")
    return kw


@router.delete("/{keyword_id}")
def delete_keyword(
    keyword_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    kw = db.query(EventKeyword).filter(EventKeyword.id == keyword_id).first()
    if not kw:
        raise HTTPException(404, "Không tìm thấy từ khoá")
    db.delete(kw)
    db.commit()
    log_activity(db, current_user, "Xoá từ khoá sự kiện", f"#{keyword_id}")
    return {"message": "Deleted"}
