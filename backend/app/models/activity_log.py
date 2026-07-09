from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class AdminActivityLog(Base):
    __tablename__ = "admin_activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    actor_name = Column(String(255), nullable=False)
    action = Column(String(200), nullable=False)
    detail = Column(String(1000), nullable=True)
    status = Column(String(20), nullable=False, default="success")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
