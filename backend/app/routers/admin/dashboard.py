from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.activity_log import AdminActivityLog
from app.models.news import NewsArticle
from app.models.user import User
from app.services.validation_service import compute_data_quality, compute_labeling_accuracy, get_news_symbol_stats

router = APIRouter()


@router.get("/dashboard")
def admin_dashboard(db: Session = Depends(get_db)):
    news_stats = get_news_symbol_stats(db)
    data_quality = compute_data_quality(db)
    labeling_accuracy = compute_labeling_accuracy(db)

    analyzed = db.query(NewsArticle).filter(NewsArticle.is_analyzed == True).all()  # noqa: E712
    trend_distribution = dict(Counter(n.predicted_trend for n in analyzed if n.predicted_trend))
    sentiment_distribution = dict(Counter(n.sentiment for n in analyzed if n.sentiment))

    activity = (
        db.query(AdminActivityLog).order_by(AdminActivityLog.created_at.desc()).limit(10).all()
    )

    total_users = db.query(User).count()
    admin_count = db.query(User).filter(User.role == "admin").count()
    customer_count = total_users - admin_count

    alerts = []
    if news_stats["review_count"] > 0:
        alerts.append(f"{news_stats['review_count']} tin đang chờ gán nhãn thủ công")
    if data_quality["overall_status"] == "FAIL":
        alerts.append("Kiểm định dữ liệu KHÔNG ĐẠT — kiểm tra trang Kiểm định dữ liệu")
    if data_quality["duplicates"] > 0:
        alerts.append(f"{data_quality['duplicates']} bản ghi tin tức trùng lặp")

    return {
        "stats": news_stats,
        "data_quality": data_quality,
        "trend_distribution": trend_distribution,
        "sentiment_distribution": sentiment_distribution,
        "activity": [
            {
                "id": a.id,
                "actor_name": a.actor_name,
                "action": a.action,
                "detail": a.detail,
                "status": a.status,
                "created_at": a.created_at,
            }
            for a in activity
        ],
        "alerts": alerts,
        "validation_results": labeling_accuracy,
        "users_summary": {
            "total": total_users,
            "admin": admin_count,
            "customer": customer_count,
        },
    }
