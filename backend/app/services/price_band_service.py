"""Vùng giá tham khảo cho trang cổ phiếu — mô tả biến động đã xảy ra, đối chiếu
với số liệu đã kiểm chứng của sản phẩm.

Bản trước lệch khỏi phần còn lại của sản phẩm ở ba chỗ; bản này sửa cả ba:

1. Nguồn giá: ưu tiên đúng bảng giá mà mô hình đang dùng (panel đóng băng + lớp
   giá live), để "giá hiện tại" ở đây là cùng một con số với giá tham chiếu trên
   thẻ tin. Chỉ khi mô hình chưa được cấu hình mới lấy lịch sử từ vnstock.
2. Đơn vị: trả về **đồng**, như mọi con số khác trên trang cổ phiếu (biểu đồ,
   giao dịch trong phiên). Bảng giá của mô hình lưu theo nghìn đồng nên được
   nhân 1.000 ở đây.
3. Không để mốc "chờ giá giảm về" đứng một mình: mốc đó ngầm gợi ý đặt mua thấp
   hơn giá hiện tại, trong khi bảng "Mua ở giá nào thì được gì" đã kiểm trên dữ
   liệu 2026 cho thấy cách đó chưa có lãi sau phí. Mỗi phản hồi vì vậy kèm số
   liệu đã kiểm chứng cho đúng mức đặt lệnh gần nhất với mốc đó.

Đây KHÔNG phải mô hình dự đoán và không phải khuyến nghị: engine luôn là
"heuristic". Độ biến động được tính đúng như cách bảng giá vào lệnh chia nhóm
(độ lệch chuẩn mẫu của lợi suất log ngày), để hai bên nói về cùng một nhóm mã.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

from app.services import finnexus_service
from app.services.stock_detail_service import get_history

SESSIONS_USED = 20
PULLBACK_STD_MULTIPLIER = 2.0
# Bảng giá của mô hình lưu theo nghìn đồng; trang cổ phiếu hiển thị theo đồng.
PANEL_TO_VND = 1000.0


def _product_history(symbol: str) -> Optional[List[Dict[str, Any]]]:
    """Các phiên gần nhất của mã trong bảng giá mô hình đang dùng, đổi sang đồng.

    None khi mô hình chưa được cấu hình — khi đó dùng vnstock thay thế.
    """
    try:
        state = finnexus_service._ensure_loaded()
    except finnexus_service.ModelUnavailable:
        return None
    resources = state["resources"]
    live = resources.get("live")
    panel = live["prices"] if live else resources["prices"]
    rows = panel[panel["symbol"] == symbol].sort_values("date").tail(SESSIONS_USED + 1)
    records: List[Dict[str, Any]] = []
    for row in rows.itertuples(index=False):
        values = [row.open, row.high, row.low, row.close]
        if any(v is None or not math.isfinite(float(v)) for v in values):
            continue
        day = row.date.date() if hasattr(row.date, "date") else row.date
        records.append({
            "time": str(day),
            "open": float(row.open) * PANEL_TO_VND,
            "high": float(row.high) * PANEL_TO_VND,
            "low": float(row.low) * PANEL_TO_VND,
            "close": float(row.close) * PANEL_TO_VND,
        })
    return records


def _log_return_volatility(closes: List[float]) -> Optional[float]:
    """Độ lệch chuẩn mẫu của lợi suất log ngày — cùng định nghĩa với đặc trưng độ
    biến động 20 phiên mà bảng giá vào lệnh dùng để chia nhóm."""
    returns = [math.log(b / a) for a, b in zip(closes, closes[1:]) if a > 0 and b > 0]
    if len(returns) < 5:
        return None
    mean = sum(returns) / len(returns)
    return math.sqrt(sum((r - mean) ** 2 for r in returns) / (len(returns) - 1))


def _validated_entry(volatility: float, pullback_depth: float) -> Optional[Dict[str, Any]]:
    """Số liệu đã kiểm chứng cho mức đặt lệnh gần nhất với mốc chờ giảm về.

    Lấy từ bảng giá vào lệnh (entry_ladder.json): cùng nhóm độ biến động nếu nhóm
    đó đủ số lần quan sát, không thì dùng toàn bộ sự kiện. None khi chưa có bảng.
    """
    ladder = finnexus_service.entry_ladder()
    if not ladder or not ladder.get("cells") or not ladder.get("levels"):
        return None
    low_cut, high_cut = ladder["volatility_cuts"]
    group: Optional[str] = "LOW" if volatility < low_cut else "MID" if volatility < high_cut else "HIGH"
    cell = ladder["cells"].get(f"VOL_{group}")
    if not cell or not cell.get("reliable"):
        cell, group = ladder["cells"].get("ALL"), None
    if not cell:
        return None
    level = min((float(v) for v in ladder["levels"]), key=lambda v: abs(v - pullback_depth))
    stats = (cell.get("levels") or {}).get(str(level)) or {}
    if stats.get("fill_rate") is None:
        return None
    validation = ladder.get("validation") or {}
    return {
        "volatility_group": group,
        "order_level": level,
        "pullback_depth": round(pullback_depth, 4),
        "fill_rate": stats.get("fill_rate"),
        "mean_net_if_filled": stats.get("mean_net_if_filled"),
        "market_at_next_open_mean_net": (cell.get("market_at_next_open") or {}).get("mean_net_if_filled"),
        "events": cell.get("events"),
        "sessions": ladder.get("sessions"),
        "round_trip_cost": ladder.get("round_trip_cost"),
        "trained_until": validation.get("trained_until"),
        "checked_on": validation.get("checked_on"),
    }


def compute_price_band(symbol: str) -> Optional[Dict]:
    symbol = symbol.upper()
    history = _product_history(symbol)
    source = "model_panel"
    if not history or len(history) < 10:
        history = get_history(symbol, days=90)
        source = "vnstock"

    rows = [r for r in history if r.get("close") and r.get("high") and r.get("low")]
    if len(rows) < 10:
        return None
    recent = rows[-SESSIONS_USED:]
    volatility = _log_return_volatility([r["close"] for r in rows[-(SESSIONS_USED + 1):]])
    if volatility is None:
        return None

    current_price = recent[-1]["close"]
    range_low = min(r["low"] for r in recent)
    range_high = max(r["high"] for r in recent)
    pullback_price = round(current_price * (1 - volatility * PULLBACK_STD_MULTIPLIER), 2)
    # Không suy diễn ra ngoài biên độ đã thật sự quan sát được trong khung nhìn.
    pullback_price = max(pullback_price, range_low)
    pullback_depth = pullback_price / current_price - 1 if current_price else 0.0

    return {
        "engine": "heuristic",
        "symbol": symbol,
        "as_of_session": recent[-1].get("time"),
        "sessions_used": len(recent),
        "price_source": source,
        "price_unit": "VND",
        "current_price": current_price,
        "range_low": range_low,
        "range_high": range_high,
        "daily_volatility_pct": round(volatility * 100, 2),
        "pullback_reference_price": pullback_price,
        "validated_entry": _validated_entry(volatility, pullback_depth),
        "is_investment_advice": False,
        "disclaimer": (
            f"Vùng giá mô tả biến động {len(recent)} phiên gần nhất, tính từ dữ liệu lịch sử thật — "
            "KHÔNG phải dự đoán hay khuyến nghị mua bán. Mốc chờ giảm về là một quy tắc thống kê; "
            "số liệu đối chiếu đi kèm cho biết lệnh đặt ở mức tương tự đã thật sự khớp và lãi/lỗ ra sao."
        ),
    }
