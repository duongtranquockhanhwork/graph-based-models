from fastapi import APIRouter, Query
from typing import Optional
from app.services.graph_service import get_graph_data, get_graph_stats, get_graph_features

router = APIRouter()


@router.get("/")
def get_full_graph(
    stock: Optional[str] = Query(None),
    industry: Optional[str] = Query(None),
    limit: int = Query(200, le=500),
):
    return get_graph_data(stock_filter=stock, industry_filter=industry, limit=limit)


@router.get("/stats")
def graph_stats():
    return get_graph_stats()


@router.get("/stock/{symbol}/features")
def stock_graph_features(symbol: str):
    return get_graph_features(symbol.upper())
