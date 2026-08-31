import json
import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from collections import Counter

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.news import NewsArticle
from app.models.user import User
from app.services.prediction_service import predict_trend_active, evaluate_model, reload_ecbm, is_ecbm_active
from app.services.graph_service import get_graph_features
from core.prediction.ecbm import METRICS_PATH

router = APIRouter()


@router.get("/evaluate")
def get_model_evaluation(db: Session = Depends(get_db)):
    return evaluate_model(db)


@router.get("/model-info")
def get_model_info():
    active_model = "ecbm" if is_ecbm_active() else "heuristic_baseline"
    metrics = None
    if os.path.exists(METRICS_PATH):
        with open(METRICS_PATH, "r", encoding="utf-8") as f:
            metrics = json.load(f)
    return {"active_model": active_model, "last_training_metrics": metrics}


@router.post("/retrain")
def retrain_model(current_user: User = Depends(require_admin)):
    from core.prediction.train import train as train_ecbm

    metrics = train_ecbm()
    if metrics.get("trained"):
        reload_ecbm()
    return metrics


@router.get("/")
def list_predictions(db: Session = Depends(get_db)):
    news = (
        db.query(NewsArticle)
        .filter(NewsArticle.is_analyzed == True, NewsArticle.predicted_trend != None)
        .order_by(NewsArticle.id.desc())
        .limit(100)
        .all()
    )
    results, seen = [], set()
    for n in news:
        for stock in n.stocks_mentioned or []:
            if stock not in seen:
                seen.add(stock)
                results.append({
                    "stock_symbol": stock,
                    "trend": n.predicted_trend,
                    "confidence": n.prediction_confidence,
                    "sentiment": n.sentiment,
                    "events": n.events_detected,
                    "news_title": n.title,
                    "published_date": n.published_date,
                })
    return results


@router.get("/stock/{symbol}")
def predict_for_stock(symbol: str, db: Session = Depends(get_db)):
    symbol = symbol.upper()
    all_news = db.query(NewsArticle).filter(NewsArticle.is_analyzed == True).all()
    relevant = [n for n in all_news if symbol in (n.stocks_mentioned or [])]
    if not relevant:
        raise HTTPException(404, f"No analyzed news for {symbol}")

    recent = sorted(relevant, key=lambda x: x.id, reverse=True)[:5]
    sentiments = [n.sentiment for n in recent if n.sentiment]
    scores = [n.impact_score for n in recent if n.impact_score]
    events = list({e for n in recent for e in (n.events_detected or [])})

    combined = {
        "stocks": [symbol],
        "companies": recent[0].companies_mentioned or [],
        "industries": recent[0].industries_mentioned or [],
        "events": events,
        "sentiment": Counter(sentiments).most_common(1)[0][0] if sentiments else "Neutral",
        "impact_score": sum(scores) / len(scores) if scores else 50.0,
    }
    gf = get_graph_features(symbol)
    result = predict_trend_active(combined, gf)
    return {"stock_symbol": symbol, **result, "based_on_news_count": len(relevant)}
