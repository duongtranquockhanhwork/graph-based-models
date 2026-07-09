from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from collections import Counter

from app.core.database import get_db
from app.models.news import NewsArticle
from app.services.stock_stats import compute_stock_stats

router = APIRouter()


@router.get("/stocks")
def stocks_stats(db: Session = Depends(get_db)):
    return compute_stock_stats(db)


@router.get("/dashboard")
def dashboard_stats(db: Session = Depends(get_db)):
    all_news = db.query(NewsArticle).all()
    analyzed = [n for n in all_news if n.is_analyzed]

    stocks, industries, sentiments, trends, dates = [], [], [], [], []
    companies = set()

    for n in analyzed:
        stocks.extend(n.stocks_mentioned or [])
        industries.extend(n.industries_mentioned or [])
        companies.update(n.companies_mentioned or [])
        if n.sentiment:
            sentiments.append(n.sentiment)
        if n.predicted_trend:
            trends.append(n.predicted_trend)
        if n.published_date:
            dates.append(str(n.published_date)[:10])

    return {
        "total_news": len(all_news),
        "analyzed_news": len(analyzed),
        "total_stocks": len(set(stocks)),
        "total_companies": len(companies),
        "sentiment_distribution": dict(Counter(sentiments)),
        "top_stocks": [{"symbol": s, "count": c} for s, c in Counter(stocks).most_common(10)],
        "top_industries": [{"industry": i, "count": c} for i, c in Counter(industries).most_common(8)],
        "trend_distribution": dict(Counter(trends)),
        "news_by_date": sorted(
            [{"date": d, "count": c} for d, c in Counter(dates).items()],
            key=lambda x: x["date"],
        )[-30:],
    }
