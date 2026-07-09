from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.stock_stats import compute_stock_stats

router = APIRouter()


@router.get("/")
def list_stocks(db: Session = Depends(get_db)):
    return compute_stock_stats(db)
