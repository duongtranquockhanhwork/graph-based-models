from sqlalchemy import Column, Integer, String, Text, DateTime, Float, JSON, Boolean
from sqlalchemy.sql import func
from app.core.database import Base


class NewsArticle(Base):
    __tablename__ = "news_articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=True)
    source = Column(String(200), nullable=True)
    published_date = Column(String(50), nullable=True)
    url = Column(String(500), nullable=True)

    stocks_mentioned = Column(JSON, default=list)
    companies_mentioned = Column(JSON, default=list)
    industries_mentioned = Column(JSON, default=list)
    events_detected = Column(JSON, default=list)
    sentiment = Column(String(20), nullable=True)
    impact_score = Column(Float, nullable=True)

    graph_built = Column(Boolean, default=False)

    predicted_trend = Column(String(20), nullable=True)
    prediction_confidence = Column(Float, nullable=True)
    prediction_explanation = Column(JSON, default=dict)

    is_analyzed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
