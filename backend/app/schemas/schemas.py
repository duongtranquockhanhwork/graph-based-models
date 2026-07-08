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
    stocks_mentioned: List[str] = []
    companies_mentioned: List[str] = []
    industries_mentioned: List[str] = []
    events_detected: List[str] = []
    sentiment: Optional[str]
    impact_score: Optional[float]
    predicted_trend: Optional[str]
    prediction_confidence: Optional[float]
    prediction_explanation: Optional[Dict[str, Any]]
    is_analyzed: bool
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
