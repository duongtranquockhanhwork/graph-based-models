from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from collections import Counter

from app.core.database import get_db
from app.models.news import NewsArticle
from app.services.prediction_service import predict_trend, evaluate_model
from app.services.graph_service import get_graph_features

router = APIRouter()


@router.get("/evaluate")
def get_model_evaluation():
    return evaluate_model()


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
    result = predict_trend(combined, gf)
    return {"stock_symbol": symbol, **result, "based_on_news_count": len(relevant)}
