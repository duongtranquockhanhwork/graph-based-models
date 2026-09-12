"""Vùng giá tham khảo tính từ giá lịch sử THẬT (vnstock, qua stock_detail_service).

Đây KHÔNG phải một mô hình dự đoán — không có nhãn, không có huấn luyện, không
có kiểm định out-of-fold. Nó chỉ đo lại biến động đã xảy ra trong N phiên gần
nhất (thấp/cao nhất, độ lệch chuẩn lợi suất ngày) rồi suy ra một mức giá "nếu
điều chỉnh giảm ~2 độ lệch chuẩn thì rơi khoảng đâu" — một quy tắc thống kê mô
tả, không phải một khuyến nghị đã được chứng minh là có lời. `engine: "heuristic"`
trên mọi phản hồi, giống mọi chỗ khác trong hệ thống dùng luật thay vì mô hình
đã kiểm chứng. Xem README mục "Ranh giới tuyên bố" trước khi dùng đầu ra này.
"""

from typing import Dict, Optional

from app.services.stock_detail_service import get_history

SESSIONS_USED = 20
PULLBACK_STD_MULTIPLIER = 2.0


def compute_price_band(symbol: str) -> Optional[Dict]:
    symbol = symbol.upper()
    history = get_history(symbol, days=90)
    if len(history) < 10:
        return None

    recent = [r for r in history if r.get("close") and r.get("high") and r.get("low")][-SESSIONS_USED:]
    if len(recent) < 10:
        return None

    closes = [r["close"] for r in recent]
    highs = [r["high"] for r in recent]
    lows = [r["low"] for r in recent]

    returns = [
        (closes[i] - closes[i - 1]) / closes[i - 1]
        for i in range(1, len(closes))
        if closes[i - 1]
    ]
    if len(returns) < 5:
        return None

    mean_return = sum(returns) / len(returns)
    variance = sum((r - mean_return) ** 2 for r in returns) / len(returns)
    daily_volatility = variance**0.5

    current_price = closes[-1]
    range_low = min(lows)
    range_high = max(highs)

    pullback_price = round(current_price * (1 - daily_volatility * PULLBACK_STD_MULTIPLIER), 2)
    # Không suy diễn ra ngoài biên độ đã thật sự quan sát được trong khung nhìn.
    pullback_price = max(pullback_price, range_low)

    return {
        "engine": "heuristic",
        "symbol": symbol,
        "as_of_session": recent[-1].get("time"),
        "sessions_used": len(recent),
        "current_price": current_price,
        "range_low": range_low,
        "range_high": range_high,
        "daily_volatility_pct": round(daily_volatility * 100, 2),
        "pullback_reference_price": pullback_price,
        "is_investment_advice": False,
        "disclaimer": (
            f"Vùng giá mô tả biến động {len(recent)} phiên gần nhất, tính từ dữ liệu lịch sử thật — "
            "KHÔNG phải dự đoán hay khuyến nghị mua bán, và không được kiểm định là có dự báo đúng "
            "hay không. Giá thực tế hoàn toàn có thể vượt ra ngoài vùng này."
        ),
    }
