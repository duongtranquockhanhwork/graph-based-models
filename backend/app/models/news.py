from sqlalchemy import Column, Integer, String, Text, DateTime, Float, JSON, Boolean, ForeignKey
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
    # SCORED | REFUSED | UNAVAILABLE | ABSTAIN | RULE_BASED — trạng thái mà
    # bộ dự đoán trả về. "Từ chối trả lời" là một kết quả, không phải lỗi,
    # nên nó được lưu chứ không bị nuốt.
    prediction_decision = Column(String(30), nullable=True)

    # Bản giải thích do Claude viết, lưu lại để mỗi bài chỉ gọi API một lần. Bản
    # ghi mang dấu vân tay đầu vào: bài được phân tích lại thì dấu đổi và bản cũ
    # không còn được dùng (xem ai_analysis_service.fingerprint).
    ai_analysis = Column(JSON, nullable=True)

    is_analyzed = Column(Boolean, default=False)

    # Ground truth xu hướng lấy từ biến động giá thật (xem
    # ground_truth/price_labels.py), không phải suy ra từ sentiment.
    # None khi chưa có đủ dữ liệu giá quanh published_date.
    actual_trend = Column(String(20), nullable=True)
    actual_trend_pct_change = Column(Float, nullable=True)

    needs_manual_label = Column(Boolean, default=False)
    manual_sentiment = Column(String(20), nullable=True)
    manual_event_type = Column(String(50), nullable=True)
    labeled_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    labeled_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
