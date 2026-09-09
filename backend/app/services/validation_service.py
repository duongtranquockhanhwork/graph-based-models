from collections import defaultdict
from typing import Dict

from sqlalchemy.orm import Session

from app.models.news import NewsArticle

RETURN_LABEL_CONSISTENCY_PASS_THRESHOLD = 80.0
# Dưới mức này nghĩa là phần lớn bài báo không dùng được cho mô hình, và bảng
# kiểm định không được phép báo ĐẠT.
USABLE_ROW_PASS_THRESHOLD = 50.0


def get_news_symbol_stats(db: Session) -> Dict:
    all_news = db.query(NewsArticle).all()
    analyzed = [n for n in all_news if n.is_analyzed]

    news_symbol_rows = sum(len(n.stocks_mentioned or []) for n in analyzed)
    model_ready = sum(
        1 for n in analyzed if n.sentiment and n.predicted_trend and (n.stocks_mentioned or [])
    )

    total_processed = len(analyzed)
    drop_count = sum(1 for n in analyzed if not (n.stocks_mentioned or []))
    review_count = sum(1 for n in analyzed if n.needs_manual_label and (n.stocks_mentioned or []))
    pass_count = total_processed - drop_count - review_count
    pass_pct = round((pass_count / total_processed) * 100, 1) if total_processed else 0.0

    return {
        "total_news": len(all_news),
        "news_symbol_rows": news_symbol_rows,
        "model_ready_rows": model_ready,
        "total_processed": total_processed,
        "pass_count": pass_count,
        "pass_pct": pass_pct,
        "review_count": review_count,
        "drop_count": drop_count,
    }


def compute_data_quality(db: Session) -> Dict:
    analyzed = db.query(NewsArticle).filter(NewsArticle.is_analyzed == True).all()  # noqa: E712

    missing_values = sum(1 for n in analyzed if not n.title or not n.sentiment)

    groups: Dict[tuple, int] = defaultdict(int)
    for n in db.query(NewsArticle).all():
        key = (n.title, tuple(sorted(n.stocks_mentioned or [])))
        groups[key] += 1
    duplicates = sum(count - 1 for count in groups.values() if count > 1)

    consistency_candidates = [n for n in analyzed if n.sentiment and n.predicted_trend]
    consistent = [
        n
        for n in consistency_candidates
        if not (n.sentiment == "Positive" and n.predicted_trend == "DECREASING")
        and not (n.sentiment == "Negative" and n.predicted_trend == "INCREASING")
    ]
    return_label_consistency = (
        round((len(consistent) / len(consistency_candidates)) * 100, 1)
        if consistency_candidates
        else 100.0
    )

    # Tỉ lệ bản ghi thực sự dùng được cho mô hình. Đây là điều kiện bị BỎ SÓT
    # trong bản trước: overall_status chỉ xét missing/duplicate/consistency,
    # nên bảng báo "PASS" trong khi pass_pct = 0.0 — không một bản ghi nào đạt.
    stats = get_news_symbol_stats(db)
    pass_pct = stats["pass_pct"]

    checks = {
        "no_missing_values": missing_values == 0,
        "no_duplicates": duplicates == 0,
        "label_consistency_ok": return_label_consistency >= RETURN_LABEL_CONSISTENCY_PASS_THRESHOLD,
        "enough_usable_rows": pass_pct >= USABLE_ROW_PASS_THRESHOLD,
    }
    failed = [name for name, ok in checks.items() if not ok]

    return {
        "missing_values": missing_values,
        "duplicates": duplicates,
        "return_label_consistency": return_label_consistency,
        "pass_pct": pass_pct,
        "checks": checks,
        "failed_checks": failed,
        "overall_status": "PASS" if not failed else "FAIL",
        # `split_leakage` đã được gỡ khỏi kết quả. Nó luôn trả về hằng số 0 và
        # được hiển thị như một phép kiểm tra thật, tạo cảm giác an toàn giả.
        # Khi hệ thống có train/test split lưu trong CSDL, hãy tính nó thật
        # (giao giữa các split_id) rồi mới đưa lại vào đây.
        "split_leakage_note": (
            "Mức chính xác của phần dự đoán giá được đo riêng, xem trang Độ chính xác."
        ),
    }


def compute_labeling_accuracy(db: Session) -> Dict:
    labeled = (
        db.query(NewsArticle)
        .filter((NewsArticle.manual_sentiment.isnot(None)) | (NewsArticle.manual_event_type.isnot(None)))
        .all()
    )

    sentiment_labeled = [n for n in labeled if n.manual_sentiment]
    sentiment_correct = sum(1 for n in sentiment_labeled if n.sentiment == n.manual_sentiment)
    accuracy_sentiment = (
        round((sentiment_correct / len(sentiment_labeled)) * 100, 2) if sentiment_labeled else None
    )

    event_labeled = [n for n in labeled if n.manual_event_type]
    event_correct = sum(1 for n in event_labeled if n.manual_event_type in (n.events_detected or []))
    accuracy_event = round((event_correct / len(event_labeled)) * 100, 2) if event_labeled else None

    return {
        "total_labeled": len(labeled),
        "sentiment_labeled_count": len(sentiment_labeled),
        "accuracy_sentiment": accuracy_sentiment,
        "event_labeled_count": len(event_labeled),
        "accuracy_event": accuracy_event,
        # Đây KHÔNG phải độ chính xác của hệ thống trên dữ liệu chung.
        # Hàng chờ gán nhãn chỉ nhận những bài mô hình không chắc chắn, nên
        # tập được gán nhãn lệch hẳn về phía khó. Con số này chỉ dùng để theo
        # dõi chất lượng bộ trích xuất NLP trên đúng nhóm ca khó đó.
        "selection_bias_note": (
            "Chỉ đo trên nhóm bài hệ thống thấy khó nhất, nên không đại diện cho toàn bộ dữ liệu."
        ),
    }
