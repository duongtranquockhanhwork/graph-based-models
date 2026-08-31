"""Backfills real article content for the SEMANTIC_V4 import (scripts/import_semantic_v4.py).

That dataset ships title/source/date/url only - no article body (see its own
manifest: outcomes/content are kept out of the release). Every one of those
965 articles was therefore analyzed from a ~10-word title alone, which is why
event detection recall was only ~15% and impact_score/reasons looked thin
even after the URL-import content-extraction bug (missing .article-content
selector on vietstock.vn) was fixed - that fix only helps NEW imports, it does
nothing for rows already in the DB with content=NULL.

This script re-fetches each article's real URL (same extraction helpers the
live /news/import-url endpoint uses - CafeF, VietnamBiz, Vietstock and
tinnhanhchungkhoan.vn were all spot-checked as still live), re-runs the app's
own analyze_article() on the real content, and rebuilds the graph + re-trains
the ECBM against the resulting richer concept vectors.

Run inside the backend container:

    python -m scripts.backfill_content
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests  # noqa: E402
from bs4 import BeautifulSoup  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.models.news import NewsArticle  # noqa: E402
from app.routers.news import _extract_by_known_selectors, _extract_by_paragraph_density  # noqa: E402
from app.services.nlp_service import analyze_article  # noqa: E402
from app.services.graph_service import get_graph_features, rebuild_graph_from_db  # noqa: E402
from app.services.prediction_service import predict_trend_active  # noqa: E402

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
}
REQUEST_INTERVAL_SECONDS = 0.4


def _fetch_content(url: str):
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        r.raise_for_status()
        r.encoding = r.apparent_encoding or "utf-8"
        soup = BeautifulSoup(r.text, "lxml")
        for tag in soup(["script", "style", "nav", "header", "footer", "aside", "form", "iframe"]):
            tag.decompose()
        return _extract_by_known_selectors(soup) or _extract_by_paragraph_density(soup)
    except Exception as e:  # noqa: BLE001 - best-effort backfill, log and move on
        print(f"  fetch failed for {url}: {e}")
        return None


def main():
    db = SessionLocal()
    try:
        articles = (
            db.query(NewsArticle)
            .filter(NewsArticle.content.is_(None), NewsArticle.url.isnot(None))
            .order_by(NewsArticle.id)
            .all()
        )
        print(f"{len(articles)} articles missing content, backfilling...")

        filled, still_empty = 0, 0
        for i, n in enumerate(articles):
            content = _fetch_content(n.url)
            if content:
                n.content = content
                result = analyze_article(n.title, content, db=db)
                gf = {}
                for stock in result.get("stocks", []):
                    gf.update(get_graph_features(stock))
                pred = predict_trend_active(result, gf)
                n.stocks_mentioned = result["stocks"]
                n.companies_mentioned = result["companies"]
                n.industries_mentioned = result["industries"]
                n.events_detected = result["events"]
                n.sentiment = result["sentiment"]
                n.impact_score = result["impact_score"]
                n.predicted_trend = pred["trend"]
                n.prediction_confidence = pred["confidence"]
                n.prediction_explanation = pred["explanation"]
                filled += 1
            else:
                still_empty += 1
            db.commit()

            if (i + 1) % 100 == 0:
                print(f"  processed {i + 1}/{len(articles)} (filled={filled}, still_empty={still_empty})")
            time.sleep(REQUEST_INTERVAL_SECONDS)

        print(f"Done: filled {filled}, still empty {still_empty}")

        print("Rebuilding graph from DB...")
        rebuild_graph_from_db(db)

        no_event = db.query(NewsArticle).filter(NewsArticle.id <= 965, NewsArticle.events_detected == []).count()
        neutral = db.query(NewsArticle).filter(NewsArticle.id <= 965, NewsArticle.sentiment == "Neutral").count()
        print(f"Post-backfill coverage: no_event={no_event}/965, neutral_sentiment={neutral}/965")

    finally:
        db.close()


if __name__ == "__main__":
    main()
