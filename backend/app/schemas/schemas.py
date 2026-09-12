from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime


class NewsCreate(BaseModel):
    title: str
    content: Optional[str] = None
    source: Optional[str] = None
    published_date: Optional[str] = None
    url: Optional[str] = None


class NewsResponse(BaseModel):
    id: int
    title: str
    content: Optional[str]
    source: Optional[str]
    published_date: Optional[str]
    # Chưa từng có trong response trước đây — "Đọc bài gốc" ở giao diện luôn
    # nhận None dù cột này có giá trị trong DB, vì response model chưa bao giờ
    # khai báo trường này.
    url: Optional[str] = None
    stocks_mentioned: List[str] = []
    companies_mentioned: List[str] = []
    industries_mentioned: List[str] = []
    events_detected: List[str] = []
    sentiment: Optional[str]
    impact_score: Optional[float]
    predicted_trend: Optional[str]
    prediction_confidence: Optional[float]
    # Trạng thái mà bộ dự đoán trả về: SCORED / ABSTAIN / REFUSED / UNAVAILABLE.
    # Không có trường này thì giao diện không phân biệt được "mô hình nói đi
    # ngang" với "mô hình không trả lời được" — hai điều hoàn toàn khác nhau.
    prediction_decision: Optional[str] = None
    prediction_explanation: Optional[Dict[str, Any]]
    # Bản giải thích của Claude nếu đã từng tạo — trả kèm để thẻ tin hiện ngay
    # mà không phải gọi thêm một request cho mỗi bài.
    ai_analysis: Optional[Dict[str, Any]] = None
    is_analyzed: bool
    needs_manual_label: bool = False
    manual_sentiment: Optional[str] = None
    manual_event_type: Optional[str] = None
    labeled_at: Optional[datetime] = None
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class GraphNode(BaseModel):
    id: str
    label: str
    type: str
    properties: Dict[str, Any] = {}
    size: float = 5.0
    color: str = "#666666"


class GraphEdge(BaseModel):
    source: str
    target: str
    relation: str
    weight: float = 1.0


class GraphData(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    metadata: Dict[str, Any] = {}
