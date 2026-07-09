from collections import Counter
from typing import Dict, List

from sqlalchemy.orm import Session

from app.models.news import NewsArticle
from app.services.nlp_service import STOCK_DICT


def compute_stock_stats(db: Session) -> List[Dict]:
    news = db.query(NewsArticle).filter(NewsArticle.is_analyzed == True).all()  # noqa: E712

    mention_counts: Counter = Counter()
    sentiment_by_stock: Dict[str, Counter] = {}
    for n in news:
        for symbol in n.stocks_mentioned or []:
            mention_counts[symbol] += 1
            if n.sentiment:
                sentiment_by_stock.setdefault(symbol, Counter())[n.sentiment] += 1

    result = []
    for symbol, info in STOCK_DICT.items():
        result.append(
            {
                "symbol": symbol,
                "company": info.get("company"),
                "industry": info.get("industry"),
                "mention_count": mention_counts.get(symbol, 0),
                "sentiment_distribution": dict(sentiment_by_stock.get(symbol, {})),
            }
        )
    result.sort(key=lambda x: x["mention_count"], reverse=True)
    return result
