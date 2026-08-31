"""One-off import of the real Vietnamese stock news dataset a teammate built
offline (backend/data/Model Training/data/SEMANTIC_V4/semantic_event_quality.csv,
965 unique articles / 54 symbols / 2019-2022) into the live app database, then
labels each imported article with a REAL price-based trend (see
core/prediction/price_labels.py) so core/prediction/train.py has an honest,
non-circular ground truth to train the ECBM against instead of the old
sentiment-derived proxy.

Every imported article goes through the app's own pipeline
(_run_analysis: analyze_article -> graph -> predict_trend_active), exactly
like a normal CSV/URL import would - this is not a shortcut that injects the
teammate's own weak labels into the app; it only reuses their real titles,
sources, dates and URLs, and lets FinNexus's own NLP/prediction stack analyze
them like any other article.

Run inside the backend container:

    python -m scripts.import_semantic_v4
"""
import csv
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal  # noqa: E402
from app.models.news import NewsArticle  # noqa: E402
from app.routers.news import _run_analysis  # noqa: E402
from core.prediction import price_labels  # noqa: E402

CSV_PATH = os.path.join(
    os.path.dirname(__file__), "..", "data", "Model Training", "data", "SEMANTIC_V4", "semantic_event_quality.csv"
)


def _load_unique_articles():
    """One row per unique news_id (source CSV has one row per (news_id,
    symbol) pair when an article discusses several stocks); the first row's
    symbol is kept as the article's primary stock for price labeling, mirroring
    train.py's own convention of using stocks_mentioned[:1]."""
    with open(CSV_PATH, encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    seen = {}
    for r in rows:
        news_id = r["news_id"]
        if news_id not in seen:
            seen[news_id] = r
    return list(seen.values())


def main():
    articles = _load_unique_articles()
    print(f"{len(articles)} unique articles found in SEMANTIC_V4 dataset")

    db = SessionLocal()
    try:
        existing_urls = {u for (u,) in db.query(NewsArticle.url).filter(NewsArticle.url.isnot(None)).all()}

        to_import = [r for r in articles if r["url"] not in existing_urls]
        print(f"{len(to_import)} not yet in the database, importing...")

        imported_ids = []
        for i, r in enumerate(to_import):
            n = NewsArticle(
                title=r["title"],
                source=r["source"] or None,
                published_date=r["published_date"] or None,
                url=r["url"] or None,
            )
            db.add(n)
            db.commit()
            db.refresh(n)
            _run_analysis(n.id, db)
            imported_ids.append(n.id)
            if (i + 1) % 100 == 0:
                print(f"  analyzed {i + 1}/{len(to_import)}")

        print(f"Imported + analyzed {len(imported_ids)} new articles")

        # --- Real price-based trend labels ---
        symbols = sorted({r["symbol"] for r in articles if r["symbol"]})
        print(f"Fetching price history for {len(symbols)} symbols via vnstock (cached after first run)...")
        price_labels.load_or_fetch_all(symbols)

        all_articles = db.query(NewsArticle).filter(NewsArticle.url.in_([r["url"] for r in articles])).all()
        primary_symbol_by_url = {r["url"]: r["symbol"] for r in articles}

        labeled, skipped = 0, 0
        trend_counts = {"INCREASING": 0, "DECREASING": 0, "UNCHANGED": 0}
        for n in all_articles:
            symbol = primary_symbol_by_url.get(n.url)
            if not symbol or not n.published_date:
                skipped += 1
                continue
            trend, pct = price_labels.compute_actual_trend(symbol, n.published_date)
            if trend is None:
                skipped += 1
                continue
            n.actual_trend = trend
            n.actual_trend_pct_change = pct
            trend_counts[trend] += 1
            labeled += 1
        db.commit()

        print(f"Real price-based trend labeled: {labeled} articles ({skipped} skipped - no price data)")
        print(f"Label distribution: {trend_counts}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
