from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.validation_service import compute_data_quality, compute_labeling_accuracy, get_news_symbol_stats

router = APIRouter()


@router.get("/data-validation")
def data_validation(db: Session = Depends(get_db)):
    return {
        **get_news_symbol_stats(db),
        **compute_data_quality(db),
    }


@router.get("/validation-results")
def validation_results(db: Session = Depends(get_db)):
    return compute_labeling_accuracy(db)
