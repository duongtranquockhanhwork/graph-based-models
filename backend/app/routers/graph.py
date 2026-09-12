from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, owner_scope
from app.models.user import User
from app.services.graph_service import get_graph_data, get_graph_stats, get_graph_features

router = APIRouter()


@router.get("/")
def get_full_graph(
    stock: Optional[str] = Query(None),
    industry: Optional[str] = Query(None),
    limit: int = Query(200, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_graph_data(
        db, owner_scope(current_user), stock_filter=stock, industry_filter=industry, limit=limit
    )


@router.get("/stats")
def graph_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_graph_stats(db, owner_scope(current_user))


@router.get("/stock/{symbol}/features")
def stock_graph_features(
    symbol: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return get_graph_features(db, owner_scope(current_user), symbol.upper())
