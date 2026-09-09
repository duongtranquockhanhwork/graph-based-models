"""Nhãn ground truth từ biến động giá thật.

Mô hình dự đoán nay do repo nghiên cứu FinNexus KG cung cấp
(app/services/finnexus_service.py). Package này chỉ còn giữ phần sinh nhãn
``actual_trend`` từ lịch sử giá — thứ dùng để ĐÁNH GIÁ mọi bộ dự đoán, và là
ground truth duy nhất không vòng tròn trong hệ thống.
"""

from ground_truth.price_labels import (
    PRICE_HORIZON_DAYS,
    PRICE_MOVE_THRESHOLD,
    TREND_LABELS,
    compute_actual_trend,
    load_or_fetch_all,
)

__all__ = [
    "PRICE_HORIZON_DAYS",
    "PRICE_MOVE_THRESHOLD",
    "TREND_LABELS",
    "compute_actual_trend",
    "load_or_fetch_all",
]
