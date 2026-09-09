from collections import Counter
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.news import NewsArticle
from app.services import finnexus_service
from app.services.graph_service import get_graph_features
from app.services.prediction_service import (
    active_engine,
    evaluate_model,
    predict_for_symbol,
)

router = APIRouter()


class ScoreRequest(BaseModel):
    title: str
    content: Optional[str] = None
    published_date: Optional[str] = None
    url: Optional[str] = None
    source: Optional[str] = None


@router.get("/evaluate")
def get_model_evaluation(db: Session = Depends(get_db)):
    return evaluate_model(db)


@router.get("/model-info")
def get_model_info():
    """Nguồn sự thật duy nhất cho mọi con số hiệu năng hiển thị trên giao diện.

    Trả về cả baseline lẫn khoảng tin cậy, vì một Macro-F1 đứng một mình không
    cho biết mô hình có tốt hơn đoán bừa hay không.
    """
    return finnexus_service.model_info()


@router.post("/score")
def score_one_article(payload: ScoreRequest):
    """Chấm thử một bài báo mà không lưu vào cơ sở dữ liệu.

    Trả nguyên trạng thái của pipeline, kể cả khi nó từ chối. Từ chối là kết
    quả hợp lệ: mô hình không nhận ra mã, hoặc không đủ 20 phiên giá trước ngày
    đăng để dựng đặc trưng.
    """
    result = finnexus_service.score_article(
        payload.title, payload.content, payload.published_date, payload.url, payload.source
    )
    if result.get("status") == "UNAVAILABLE":
        raise HTTPException(
            503,
            {
                "message": "Mô hình dự đoán chưa được cấu hình trên máy chủ này.",
                "reason": result.get("reason"),
            },
        )
    return result


@router.get("/")
def list_predictions(db: Session = Depends(get_db), limit: int = 100):
    """Danh sách dự đoán gần nhất theo mã.

    Chỉ trả về những mã mô hình THỰC SỰ đã chấm. Bài mà mô hình từ chối không
    xuất hiện ở đây dưới dạng một nhãn trống — chúng được đếm riêng để giao
    diện nói được "còn N bài chưa chấm được, vì sao".
    """
    news = (
        db.query(NewsArticle)
        .filter(NewsArticle.is_analyzed == True)  # noqa: E712
        .order_by(NewsArticle.id.desc())
        .limit(limit)
        .all()
    )

    results, seen = [], set()
    refused = 0
    for n in news:
        if not n.predicted_trend:
            refused += 1
            continue
        explanation = n.prediction_explanation or {}
        for stock in n.stocks_mentioned or []:
            if stock in seen:
                continue
            seen.add(stock)
            results.append(
                {
                    "stock_symbol": stock,
                    "trend": n.predicted_trend,
                    "confidence": n.prediction_confidence,
                    "decision": n.prediction_decision,
                    "sentiment": n.sentiment,
                    "events": n.events_detected,
                    "news_id": n.id,
                    "news_title": n.title,
                    "published_date": n.published_date,
                    "engine": explanation.get("engine"),
                    "is_primary": explanation.get("primary_symbol") == stock,
                }
            )

    return {
        "predictions": results,
        "refused_count": refused,
        "engine": active_engine(),
        "is_investment_advice": False,
    }


@router.get("/stock/{symbol}")
def predict_for_stock(symbol: str, db: Session = Depends(get_db)):
    """Tổng hợp ở cấp mã từ các tin gần đây.

    Đây KHÔNG phải đầu ra của mô hình FinNexus: mô hình chấm theo cặp bài–mã
    tại một thời điểm, nó không có khái niệm "xu hướng chung của một mã". Kết
    quả dưới đây là tổng hợp theo luật, và được đánh dấu như vậy.
    """
    symbol = symbol.upper()
    relevant = (
        db.query(NewsArticle)
        .filter(NewsArticle.is_analyzed == True)  # noqa: E712
        .order_by(NewsArticle.id.desc())
        .limit(500)
        .all()
    )
    relevant = [n for n in relevant if symbol in (n.stocks_mentioned or [])]
    if not relevant:
        raise HTTPException(404, f"Chưa có tin nào đã phân tích cho mã {symbol}")

    recent = relevant[:5]
    sentiments = [n.sentiment for n in recent if n.sentiment]
    scores = [n.impact_score for n in recent if n.impact_score is not None]
    events = list({e for n in recent for e in (n.events_detected or [])})

    combined = {
        "stocks": [symbol],
        "companies": recent[0].companies_mentioned or [],
        "industries": recent[0].industries_mentioned or [],
        "events": events,
        "sentiment": Counter(sentiments).most_common(1)[0][0] if sentiments else "Neutral",
        "impact_score": sum(scores) / len(scores) if scores else 50.0,
    }
    result = predict_for_symbol(symbol, combined, get_graph_features(symbol))
    return {
        "stock_symbol": symbol,
        **result,
        "based_on_news_count": len(relevant),
        "is_investment_advice": False,
    }
