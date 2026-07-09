from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AdminUserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None


class EventKeywordCreate(BaseModel):
    event_type: str
    label_vi: str
    keyword: str
    is_active: bool = True


class EventKeywordUpdate(BaseModel):
    event_type: Optional[str] = None
    label_vi: Optional[str] = None
    keyword: Optional[str] = None
    is_active: Optional[bool] = None


class EventKeywordOut(BaseModel):
    id: int
    event_type: str
    label_vi: str
    keyword: str
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SystemSettingUpdate(BaseModel):
    value: str


class SystemSettingOut(BaseModel):
    key: str
    value: str
    description: Optional[str] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NewsLabelSubmit(BaseModel):
    manual_sentiment: Optional[str] = None
    manual_event_type: Optional[str] = None


class NewsPatch(BaseModel):
    title: Optional[str] = None
    source: Optional[str] = None
    sentiment: Optional[str] = None
    impact_score: Optional[float] = None
