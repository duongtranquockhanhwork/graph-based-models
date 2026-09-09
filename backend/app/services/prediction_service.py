"""Dự đoán xu hướng và đánh giá mô hình.

Hệ thống có hai bộ máy, và luôn nói rõ đang dùng bộ nào:

* **FinNexus V56** (mặc định khi ``FINNEXUS_ROOT`` được cấu hình) — XGBoost 33
  đặc trưng thị trường, nhãn là hướng abnormal return 3 phiên với ngưỡng ±2%.
  Có baseline một biến để so, có khoảng tin cậy, có ngưỡng vận hành để từ chối
  trả lời khi không đủ tin cậy.
* **Bộ luật heuristic** — chỉ dùng khi mô hình không khả dụng. Nó là một hàm
  cộng điểm từ sentiment/sự kiện/đồ thị, KHÔNG được huấn luyện và KHÔNG có
  bằng chứng nào cho thấy nó dự đoán đúng. Mọi kết quả của nó được đánh dấu
  ``engine: "heuristic"`` để tầng hiển thị cảnh báo đúng mức.

Bản trước dùng một mô hình ECBM đạt Macro-F1 0.3516 trên bài toán 3 lớp — ngang
mức đoán ngẫu nhiên — và ưu tiên nó hơn heuristic bất cứ khi nào có checkpoint.
Mô hình đó đã được gỡ bỏ.
"""

from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.services import finnexus_service

SENTIMENT_MAP = {"Positive": 1, "Neutral": 0, "Negative": -1}
TREND_LABELS = ["INCREASING", "DECREASING", "UNCHANGED"]
TREND_LABELS_VI = {
    "INCREASING": "TĂNG",
    "DECREASING": "GIẢM",
    "UNCHANGED": "ỔN ĐỊNH/ĐI NGANG",
}

MIN_EVALUATION_SAMPLES = 20

EVENT_IMPACT = {
    "profit_growth": 2,
    "new_contract": 2,
    "expansion": 1,
    "dividend": 1,
    "merger": 1,
    "share_issuance": 0,
    "leadership_change": -1,
    "penalty": -2,
    "profit_decline": -2,
}


# --------------------------------------------------------------------------
# Bộ luật heuristic (dự phòng)
# --------------------------------------------------------------------------

def predict_trend(analysis: Dict, graph_features: Dict) -> Dict:
    """Cộng điểm theo luật viết tay. Không được huấn luyện, không có bằng chứng
    hiệu năng — chỉ là một cách diễn giải nhất quán các tín hiệu NLP đã trích."""
    sentiment = analysis.get("sentiment", "Neutral")
    events = analysis.get("events", [])
    impact = analysis.get("impact_score", 50)
    gf = graph_features or {}

    score = 0.0
    score += SENTIMENT_MAP.get(sentiment, 0) * 30
    score += sum(EVENT_IMPACT.get(e, 0) for e in events) * 15
    score += (impact - 50) * 0.4
    score += gf.get("sentiment_ratio", 0.5) * 20 - 10
    score += min(gf.get("positive_news_count", 0), 5) * 3
    score -= min(gf.get("negative_news_count", 0), 5) * 3

    if score > 15:
        trend = "INCREASING"
        confidence = min(0.55 + score / 100, 0.95)
    elif score < -15:
        trend = "DECREASING"
        confidence = min(0.55 + abs(score) / 100, 0.95)
    else:
        trend = "UNCHANGED"
        confidence = 0.50 + (15 - abs(score)) / 100

    reasons = list(analysis.get("reasons", []))

    if gf.get("mention_frequency", 0) > 3:
        reasons.append(f"Cổ phiếu được nhắc đến nhiều trong dữ liệu ({gf['mention_frequency']} lần)")
    if gf.get("degree_centrality", 0) > 0.3:
        reasons.append("Cổ phiếu có nhiều kết nối trong Knowledge Graph, mức lan tỏa ảnh hưởng cao")
    sr = gf.get("sentiment_ratio", 0.5)
    if sr > 0.6:
        reasons.append(f"Tỷ lệ tin tích cực liên quan đến cổ phiếu này trong graph cao ({round(sr * 100)}%)")
    elif sr < 0.4:
        reasons.append(f"Tỷ lệ tin tiêu cực liên quan đến cổ phiếu này trong graph cao ({round((1 - sr) * 100)}%)")

    reasons.append(
        f"=> Suy luận theo luật: xu hướng {TREND_LABELS_VI[trend]} "
        f"(điểm tổng hợp {round(score, 2)})"
    )

    return {
        "trend": trend,
        "confidence": round(confidence, 3),
        "decision": "RULE_BASED",
        "explanation": {
            "engine": "heuristic",
            "status": "SCORED",
            "warning": (
                "Kết quả này đến từ bộ luật viết tay, không phải mô hình đã kiểm chứng. "
                "Không có số đo hiệu năng nào cho nó."
            ),
            "reasons": reasons,
            "composite_score": round(score, 2),
            "sentiment_contribution": SENTIMENT_MAP.get(sentiment, 0) * 30,
            "event_contribution": sum(EVENT_IMPACT.get(e, 0) for e in events) * 15,
            "graph_contribution": round(gf.get("sentiment_ratio", 0.5) * 20 - 10, 2),
            "is_investment_advice": False,
            "tradeable": False,
        },
    }


# --------------------------------------------------------------------------
# Bộ điều phối
# --------------------------------------------------------------------------

def active_engine() -> str:
    return "finnexus" if finnexus_service.is_available() else "heuristic"


def predict_for_article(
    analysis: Dict,
    graph_features: Dict,
    title: str,
    content: Optional[str],
    published_date: Optional[str],
    url: Optional[str] = None,
    source: Optional[str] = None,
) -> Dict:
    """Đường đi chính khi phân tích một bài báo.

    Ưu tiên FinNexus. Khi FinNexus TỪ CHỐI (không nhận ra mã, thiếu lịch sử
    giá), ta giữ nguyên lời từ chối đó — kèm thêm suy luận heuristic đánh dấu
    rõ ràng để người dùng vẫn thấy được bài báo nói gì, nhưng không nhầm nó
    với một dự đoán có kiểm chứng.
    """
    result = finnexus_service.score_article(
        title,
        content,
        published_date,
        url,
        source,
        # Mã do bộ NLP của app phân giải từ tên công ty ("Vinamilk" -> VNM).
        # Không có bước này, mô hình từ chối mọi bài chỉ gọi tên công ty —
        # tức phần lớn tin tiếng Việt.
        linked_symbols=analysis.get("stocks"),
    )
    fields = finnexus_service.to_prediction_fields(result)

    if fields["predicted_trend"] is not None:
        return fields

    fallback = predict_trend(analysis, graph_features)
    explanation = dict(fields["prediction_explanation"])
    explanation["fallback"] = fallback["explanation"]
    explanation["fallback_trend"] = fallback["trend"]
    return {
        "predicted_trend": None,
        "prediction_confidence": None,
        "prediction_decision": fields["prediction_decision"],
        "prediction_explanation": explanation,
    }


def predict_for_symbol(symbol: str, analysis: Dict, graph_features: Dict) -> Dict:
    """Dự đoán ở cấp mã, tổng hợp từ các tin gần đây. Không có một bài báo cụ
    thể nào để đưa vào FinNexus (nó chấm theo cặp bài–mã), nên đường này dùng
    heuristic và nói rõ như vậy."""
    return predict_trend(analysis, graph_features)


# --------------------------------------------------------------------------
# Đánh giá
# --------------------------------------------------------------------------

def _macro_f1(y_true: List[str], y_pred: List[str]) -> float:
    from sklearn.metrics import f1_score

    return round(f1_score(y_true, y_pred, average="macro", zero_division=0), 4)


def evaluate_model(db: Session) -> Dict:
    """Đánh giá trên nhãn giá thật, và CHỈ trên nhãn giá thật.

    Bản trước cho phép lấy ground truth từ ``manual_sentiment`` khi thiếu
    ``actual_trend``, ánh xạ bằng đúng bảng SENTIMENT_TO_TREND mà bộ dự đoán
    cũng dùng. Đó là đo mô hình với chính nó. Nhãn cảm xúc do người gán vẫn
    hữu ích để kiểm tra chất lượng NLP (xem validation_service), nhưng không
    phải là kết quả thị trường và không được dùng làm ground truth ở đây.
    """
    from app.models.news import NewsArticle

    labeled = (
        db.query(NewsArticle)
        .filter(
            NewsArticle.is_analyzed == True,  # noqa: E712
            NewsArticle.actual_trend.isnot(None),
            NewsArticle.predicted_trend.isnot(None),
        )
        .all()
    )

    engine = active_engine()
    base = {
        "engine": engine,
        "ground_truth": "diễn biến giá thật sau ngày đăng bài",
        "labels": TREND_LABELS,
        "is_investment_advice": False,
    }

    if len(labeled) < MIN_EVALUATION_SAMPLES:
        return {
            **base,
            "insufficient_data": True,
            "sample_size": len(labeled),
            "required_samples": MIN_EVALUATION_SAMPLES,
            "message": (
                f"Cần ít nhất {MIN_EVALUATION_SAMPLES} bài đã biết giá chạy thế nào sau ngày đăng "
                f"để đối chiếu (hiện có {len(labeled)}). Nhập thêm tin cũ — tin càng cũ thì càng "
                "có sẵn diễn biến giá để so."
            ),
        }

    from collections import Counter

    from sklearn.metrics import (
        accuracy_score,
        classification_report,
        confusion_matrix,
        f1_score,
        precision_score,
        recall_score,
    )

    y_true = [n.actual_trend for n in labeled]
    y_pred = [n.predicted_trend for n in labeled]

    # Baseline bắt buộc: đoán luôn lớp phổ biến nhất. Mọi con số accuracy phải
    # đọc trên nền này — không có nó thì "62%" không nói lên điều gì.
    majority = Counter(y_true).most_common(1)[0][0]
    y_majority = [majority] * len(y_true)

    accuracy = accuracy_score(y_true, y_pred)
    majority_accuracy = accuracy_score(y_true, y_majority)

    return {
        **base,
        "insufficient_data": False,
        "sample_size": len(labeled),
        "accuracy": round(accuracy, 4),
        "precision": round(precision_score(y_true, y_pred, average="weighted", zero_division=0), 4),
        "recall": round(recall_score(y_true, y_pred, average="weighted", zero_division=0), 4),
        "f1_score": round(f1_score(y_true, y_pred, average="weighted", zero_division=0), 4),
        "macro_f1": _macro_f1(y_true, y_pred),
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=TREND_LABELS).tolist(),
        "class_report": classification_report(
            y_true, y_pred, labels=TREND_LABELS, output_dict=True, zero_division=0
        ),
        "baseline": {
            "name": "majority_class",
            "predicts": majority,
            "accuracy": round(majority_accuracy, 4),
            "macro_f1": _macro_f1(y_true, y_majority),
        },
        "delta_accuracy_vs_majority": round(accuracy - majority_accuracy, 4),
        "beats_majority": bool(accuracy > majority_accuracy),
        "label_distribution": dict(Counter(y_true)),
        "caveat": (
            "Đây là số đo trên dữ liệu riêng của bạn, không phải kết quả thí nghiệm chính thức. "
            "Con số chính thức nằm ở phần trên của trang này."
        ),
    }
