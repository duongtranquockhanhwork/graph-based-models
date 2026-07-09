from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.system_setting import SystemSetting
from app.models.user import User
from app.schemas.admin import SystemSettingOut, SystemSettingUpdate
from app.services.activity_log import log_activity

router = APIRouter()


@router.get("/", response_model=List[SystemSettingOut])
def list_settings(db: Session = Depends(get_db)):
    return db.query(SystemSetting).order_by(SystemSetting.key.asc()).all()


@router.patch("/{key}", response_model=SystemSettingOut)
def update_setting(
    key: str,
    payload: SystemSettingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not setting:
        raise HTTPException(404, "Không tìm thấy cấu hình")
    setting.value = payload.value
    db.commit()
    db.refresh(setting)
    log_activity(db, current_user, "Cập nhật cấu hình hệ thống", f"{key} = {payload.value}")
    return setting
