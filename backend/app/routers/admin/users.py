from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.admin import AdminUserUpdate
from app.services.activity_log import log_activity

router = APIRouter()


@router.get("/")
def list_users(q: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(User)
    if q:
        query = query.filter(User.email.ilike(f"%{q}%") | User.full_name.ilike(f"%{q}%"))
    users = query.order_by(User.id.asc()).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at,
        }
        for u in users
    ]


@router.patch("/{user_id}")
def update_user(
    user_id: int,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Không tìm thấy người dùng")

    demoting = payload.role is not None and payload.role != "admin" and user.role == "admin"
    deactivating = payload.is_active is False and user.is_active

    if (demoting or deactivating) and user.role == "admin":
        other_active_admins = (
            db.query(User)
            .filter(User.role == "admin", User.is_active == True, User.id != user.id)  # noqa: E712
            .count()
        )
        if other_active_admins == 0:
            raise HTTPException(400, "Không thể hạ quyền/khoá tài khoản quản trị viên cuối cùng")

    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    db.commit()
    db.refresh(user)

    log_activity(
        db,
        current_user,
        "Cập nhật người dùng",
        f"{user.email}: role={user.role}, is_active={user.is_active}",
    )

    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
    }
