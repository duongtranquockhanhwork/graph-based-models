from typing import Dict, List, Optional
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sqlalchemy.orm import Session

from core.prediction.ecbm import ECBMPredictor

SENTIMENT_MAP = {"Positive": 1, "Neutral": 0, "Negative": -1}
TREND_LABELS = ["INCREASING", "DECREASING", "UNCHANGED"]

# Cùng quy ước ánh xạ cảm xúc -> xu hướng đã dùng trong compute_data_quality
# (validation_service.py) để suy ra ground truth từ nhãn cảm xúc đã gán thủ công.
SENTIMENT_TO_TREND = {"Positive": "INCREASING", "Negative": "DECREASING", "Neutral": "UNCHANGED"}

MIN_EVALUATION_SAMPLES = 5

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


def predict_trend(analysis: Dict, graph_features: Dict) -> Dict:
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

    # Bắt đầu từ các lý do cụ thể đã trích dẫn bằng chứng trực tiếp trong bài
    # báo (từ khóa, sự kiện, ngành nghề) do nlp_service phân tích, sau đó bổ
    # sung thêm các lý do dựa trên Knowledge Graph nếu có.
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

    trend_label = {"INCREASING": "TĂNG", "DECREASING": "GIẢM", "UNCHANGED": "ỔN ĐỊNH/ĐI NGANG"}
    reasons.append(
        f"=> Dự đoán xu hướng cổ phiếu: {trend_label[trend]} "
        f"(độ tin cậy {round(confidence * 100)}%, điểm tổng hợp {round(score, 2)})"
    )

    return {
        "trend": trend,
        "confidence": round(confidence, 3),
        "explanation": {
            "reasons": reasons,
            "composite_score": round(score, 2),
            "sentiment_contribution": SENTIMENT_MAP.get(sentiment, 0) * 30,
            "event_contribution": sum(EVENT_IMPACT.get(e, 0) for e in events) * 15,
            "graph_contribution": round(gf.get("sentiment_ratio", 0.5) * 20 - 10, 2),
        },
        "features": {
            "sentiment": float(SENTIMENT_MAP.get(sentiment, 0)),
            "impact_score": float(impact),
            "event_score": float(sum(EVENT_IMPACT.get(e, 0) for e in events)),
            "degree_centrality": float(gf.get("degree_centrality", 0)),
            "mention_frequency": float(gf.get("mention_frequency", 0)),
            "sentiment_ratio": float(gf.get("sentiment_ratio", 0.5)),
        },
    }


_ecbm_predictor: Optional[ECBMPredictor] = None
_ecbm_loaded = False


def _get_ecbm_predictor() -> Optional[ECBMPredictor]:
    """Lazily loads the trained ECBM checkpoint, if one exists yet."""
    global _ecbm_predictor, _ecbm_loaded
    if not _ecbm_loaded:
        _ecbm_predictor = ECBMPredictor.load()
        _ecbm_loaded = True
    return _ecbm_predictor


def is_ecbm_active() -> bool:
    return _get_ecbm_predictor() is not None


def reload_ecbm() -> None:
    """Forces the next prediction to re-read the checkpoint (after a retrain)."""
    global _ecbm_predictor, _ecbm_loaded
    _ecbm_predictor = None
    _ecbm_loaded = False


def predict_trend_ecbm(analysis: Dict, graph_features: Dict) -> Dict:
    predictor = _get_ecbm_predictor()
    if predictor is None:
        raise ValueError("Chưa có checkpoint ECBM đã train (chạy: python -m core.prediction.train)")
    result = predictor.predict(analysis, graph_features)
    return {
        "trend": result["trend"],
        "confidence": round(result["confidence"], 3),
        "explanation": {
            "reasons": result["reasons"],
            "free_energy": round(result["free_energy"], 3),
            "class_probabilities": {k: round(v, 3) for k, v in result["probs"].items()},
        },
        "features": result["concepts"],
    }


def predict_trend_active(analysis: Dict, graph_features: Dict) -> Dict:
    """Dispatcher used by the API: prefers the trained ECBM, falls back to the
    hand-tuned heuristic (predict_trend) so the app keeps working before the
    first training run.
    """
    if _get_ecbm_predictor() is not None:
        return predict_trend_ecbm(analysis, graph_features)
    return predict_trend(analysis, graph_features)


def evaluate_model(db: Session) -> Dict:
    from app.models.news import NewsArticle

    labeled = (
        db.query(NewsArticle)
        .filter(
            NewsArticle.is_analyzed == True,  # noqa: E712
            (NewsArticle.actual_trend.isnot(None)) | (NewsArticle.manual_sentiment.isnot(None)),
        )
        .all()
    )

    if len(labeled) < MIN_EVALUATION_SAMPLES:
        return {
            "insufficient_data": True,
            "sample_size": len(labeled),
            "accuracy": 0.0,
            "precision": 0.0,
            "recall": 0.0,
            "f1_score": 0.0,
            "confusion_matrix": [],
            "class_report": {},
            "baseline_accuracy": 0.0,
            "graph_enhanced_accuracy": 0.0,
            "ecbm_accuracy": None,
            "ecbm_confusion_matrix": None,
            "ecbm_class_report": None,
            "labels": TREND_LABELS,
        }

    y_true: List[str] = []
    y_enhanced: List[str] = []
    y_baseline: List[str] = []
    y_ecbm: List[str] = []
    ecbm_predictor = _get_ecbm_predictor()

    for n in labeled:
        y_true.append(n.actual_trend or SENTIMENT_TO_TREND.get(n.manual_sentiment, "UNCHANGED"))
        y_enhanced.append(n.predicted_trend or "UNCHANGED")

        baseline_analysis = {
            "sentiment": n.sentiment or "Neutral",
            "events": n.events_detected or [],
            "impact_score": n.impact_score if n.impact_score is not None else 50.0,
        }
        y_baseline.append(predict_trend(baseline_analysis, {})["trend"])
        if ecbm_predictor is not None:
            y_ecbm.append(ecbm_predictor.predict(baseline_analysis, {})["trend"])

    from sklearn.metrics import precision_score, recall_score, f1_score
    return {
        "insufficient_data": False,
        "sample_size": len(labeled),
        "accuracy": round(accuracy_score(y_true, y_enhanced), 4),
        "precision": round(precision_score(y_true, y_enhanced, average="weighted", zero_division=0), 4),
        "recall": round(recall_score(y_true, y_enhanced, average="weighted", zero_division=0), 4),
        "f1_score": round(f1_score(y_true, y_enhanced, average="weighted", zero_division=0), 4),
        "confusion_matrix": confusion_matrix(y_true, y_enhanced, labels=TREND_LABELS).tolist(),
        "class_report": classification_report(y_true, y_enhanced, labels=TREND_LABELS, output_dict=True, zero_division=0),
        "baseline_accuracy": round(accuracy_score(y_true, y_baseline), 4),
        "graph_enhanced_accuracy": round(accuracy_score(y_true, y_enhanced), 4),
        "ecbm_accuracy": round(accuracy_score(y_true, y_ecbm), 4) if y_ecbm else None,
        # Separate from confusion_matrix/class_report above (those describe
        # the heuristic y_enhanced) so the dashboard can show what the
        # actually-deployed model (ECBM, once trained) gets right/wrong
        # per class, instead of only a single accuracy scalar that hides
        # a majority-class collapse.
        "ecbm_confusion_matrix": confusion_matrix(y_true, y_ecbm, labels=TREND_LABELS).tolist() if y_ecbm else None,
        "ecbm_class_report": (
            classification_report(y_true, y_ecbm, labels=TREND_LABELS, output_dict=True, zero_division=0)
            if y_ecbm
            else None
        ),
        "labels": TREND_LABELS,
    }
