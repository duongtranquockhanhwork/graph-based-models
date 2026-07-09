from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import pandas as pd
import io

from app.core.database import get_db
from app.models.news import NewsArticle
from app.schemas.schemas import NewsCreate, NewsResponse
from app.services.nlp_service import analyze_article
from app.services.graph_service import add_news_to_graph, get_graph_features
from app.services.prediction_service import predict_trend
from pydantic import BaseModel

router = APIRouter()


class UrlImportRequest(BaseModel):
    url: str


def _run_analysis(news_id: int, db: Session):
    news = db.query(NewsArticle).filter(NewsArticle.id == news_id).first()
    if not news:
        return
    result = analyze_article(news.title, news.content)
    gf = {}
    for stock in result.get("stocks", []):
        gf.update(get_graph_features(stock))
    # Luôn chạy predict_trend để mọi bài báo đã phân tích đều có "lý do" cụ
    # thể, kể cả khi không nhận diện được mã cổ phiếu nào (gf sẽ rỗng).
    pred = predict_trend(result, gf)
    news.stocks_mentioned = result["stocks"]
    news.companies_mentioned = result["companies"]
    news.industries_mentioned = result["industries"]
    news.events_detected = result["events"]
    news.sentiment = result["sentiment"]
    news.impact_score = result["impact_score"]
    news.predicted_trend = pred["trend"]
    news.prediction_confidence = pred["confidence"]
    news.prediction_explanation = pred["explanation"]
    news.is_analyzed = True
    add_news_to_graph(news_id, result)
    news.graph_built = True
    db.commit()


@router.post("/upload-csv")
async def upload_csv(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
):
    raw = await file.read()
    try:
        df = pd.read_csv(io.StringIO(raw.decode("utf-8")))
    except Exception:
        df = pd.read_csv(io.StringIO(raw.decode("utf-8-sig")))

    if "title" not in df.columns:
        raise HTTPException(400, "CSV must contain a 'title' column")

    ids = []
    for _, row in df.iterrows():
        n = NewsArticle(
            title=str(row.get("title", "")),
            content=str(row["content"]) if "content" in row and pd.notna(row["content"]) else None,
            source=str(row["source"]) if "source" in row and pd.notna(row["source"]) else None,
            published_date=str(row["published_date"]) if "published_date" in row and pd.notna(row["published_date"]) else None,
            url=str(row["url"]) if "url" in row and pd.notna(row["url"]) else None,
        )
        db.add(n)
        db.commit()
        db.refresh(n)
        background_tasks.add_task(_run_analysis, n.id, db)
        ids.append(n.id)

    return {"message": f"Imported {len(ids)} articles", "ids": ids}


@router.post("/import-url")
def import_from_url(
    req: UrlImportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    try:
        import requests as http_req
        from bs4 import BeautifulSoup
        from urllib.parse import urlparse

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
        }

        response = http_req.get(req.url, headers=headers, timeout=15)
        response.raise_for_status()
        response.encoding = response.apparent_encoding or "utf-8"

        soup = BeautifulSoup(response.text, "lxml")

        # Remove noise tags
        for tag in soup(["script", "style", "nav", "header", "footer", "aside", "form", "iframe"]):
            tag.decompose()

        # Extract title
        title = None
        for sel in [
            "h1.title-detail", "h1.article-title", "h1.post-title",
            ".article-title h1", ".title-detail", "h1",
        ]:
            elem = soup.select_one(sel)
            if elem:
                title = elem.get_text(strip=True)
                break

        if not title:
            og_title = soup.find("meta", property="og:title")
            if og_title:
                title = og_title.get("content", "").strip()

        if not title:
            title_tag = soup.find("title")
            if title_tag:
                title = title_tag.get_text(strip=True)

        if not title or len(title) < 5:
            raise HTTPException(400, "Không thể trích xuất tiêu đề từ URL này")

        # Extract content
        content = None
        for sel in [
            "article.fck_detail", ".fck_detail", "article",
            ".article-body", ".detail-content", ".content-detail",
            ".post-content", ".entry-content", "main",
        ]:
            elem = soup.select_one(sel)
            if elem:
                text = elem.get_text(separator="\n", strip=True)
                if len(text) > 100:
                    content = text[:5000]
                    break

        # Extract published date from meta
        published_date = None
        for prop in ["article:published_time", "og:updated_time"]:
            meta = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
            if meta:
                raw_date = meta.get("content", "")
                if raw_date:
                    published_date = raw_date[:10]
                    break

        # Extract source domain
        parsed = urlparse(req.url)
        source = parsed.netloc.replace("www.", "")

        news_item = NewsArticle(
            title=title,
            content=content,
            source=source,
            published_date=published_date,
            url=req.url,
        )
        db.add(news_item)
        db.commit()
        db.refresh(news_item)
        background_tasks.add_task(_run_analysis, news_item.id, db)

        return {
            "id": news_item.id,
            "title": title,
            "source": source,
            "published_date": published_date,
            "message": "Đã import và đang phân tích",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Lỗi khi import URL: {str(e)}")


@router.post("/")
def create_news(news_in: NewsCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    n = NewsArticle(**news_in.model_dump())
    db.add(n)
    db.commit()
    db.refresh(n)
    background_tasks.add_task(_run_analysis, n.id, db)
    return {"id": n.id, "message": "Created and queued for analysis"}


@router.get("/", response_model=List[NewsResponse])
def list_news(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return db.query(NewsArticle).order_by(NewsArticle.id.desc()).offset(skip).limit(limit).all()


@router.get("/{news_id}", response_model=NewsResponse)
def get_news(news_id: int, db: Session = Depends(get_db)):
    n = db.query(NewsArticle).filter(NewsArticle.id == news_id).first()
    if not n:
        raise HTTPException(404, "Not found")
    return n


@router.post("/{news_id}/analyze")
def analyze_news(news_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    n = db.query(NewsArticle).filter(NewsArticle.id == news_id).first()
    if not n:
        raise HTTPException(404, "Not found")
    background_tasks.add_task(_run_analysis, news_id, db)
    return {"message": "Queued", "news_id": news_id}


@router.post("/analyze-all")
def analyze_all(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    pending = db.query(NewsArticle).filter(NewsArticle.is_analyzed == False).all()
    for n in pending:
        background_tasks.add_task(_run_analysis, n.id, db)
    return {"message": f"Queued {len(pending)} articles"}


@router.delete("/{news_id}")
def delete_news(news_id: int, db: Session = Depends(get_db)):
    n = db.query(NewsArticle).filter(NewsArticle.id == news_id).first()
    if not n:
        raise HTTPException(404, "Not found")
    db.delete(n)
    db.commit()
    return {"message": "Deleted"}
