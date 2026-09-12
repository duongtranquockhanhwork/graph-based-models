"""Vùng giá tham khảo (price_band_service) — quy tắc thống kê mô tả, không
phải dự đoán. Test này khoá lại các bất biến mà một vùng giá đúng không được
vi phạm, và rằng router trả 404 rõ ràng khi không đủ dữ liệu thay vì một vùng
giá tính trên quá ít phiên.
"""

from unittest.mock import patch

from app.services import price_band_service
from tests.conftest import auth


def _session(day: int, close: float, low: float | None = None, high: float | None = None):
    return {
        "time": f"2026-08-{day:02d}",
        "open": close,
        "close": close,
        "low": low if low is not None else close - 1,
        "high": high if high is not None else close + 1,
        "volume": 100000,
    }


class TestComputePriceBand:
    def test_too_few_sessions_returns_none(self):
        with patch("app.services.price_band_service.get_history", return_value=[_session(i, 20.0) for i in range(1, 5)]):
            assert price_band_service.compute_price_band("FPT") is None

    def test_basic_invariants_hold(self):
        # Giá tăng dần đều — đủ 20 phiên trở lên để qua ngưỡng tối thiểu.
        history = [_session(i, 20.0 + i * 0.1) for i in range(1, 26)]
        with patch("app.services.price_band_service.get_history", return_value=history):
            band = price_band_service.compute_price_band("fpt")

        assert band is not None
        assert band["engine"] == "heuristic"
        assert band["is_investment_advice"] is False
        assert band["symbol"] == "FPT"  # tự viết hoa
        assert band["sessions_used"] == price_band_service.SESSIONS_USED
        assert band["current_price"] == history[-1]["close"]
        # Vùng giá không được rộng hơn biên độ thật sự quan sát được.
        assert band["range_low"] <= band["current_price"] <= band["range_high"]
        # Mốc "chờ giá giảm về" không được thấp hơn mức thấp nhất đã quan sát.
        assert band["pullback_reference_price"] >= band["range_low"]
        assert band["pullback_reference_price"] <= band["current_price"]
        assert band["daily_volatility_pct"] >= 0
        assert "disclaimer" in band and "KHÔNG" in band["disclaimer"]

    def test_zero_volatility_pulls_back_to_current_price(self):
        # Giá đứng yên tuyệt đối 20 phiên -> độ lệch chuẩn lợi suất = 0 -> mốc
        # "chờ giảm về" trùng giá hiện tại (không có gì để chờ).
        history = [_session(i, 20.0, low=19.5, high=20.5) for i in range(1, 26)]
        with patch("app.services.price_band_service.get_history", return_value=history):
            band = price_band_service.compute_price_band("FPT")

        assert band["daily_volatility_pct"] == 0
        assert band["pullback_reference_price"] == band["current_price"]


class TestPriceBandEndpoint:
    def test_returns_404_when_not_enough_data(self, client, user_token):
        with patch("app.services.price_band_service.get_history", return_value=[]):
            r = client.get("/api/stock-detail/FPT/price-band", headers=auth(user_token))
        assert r.status_code == 404

    def test_returns_band_when_available(self, client, user_token):
        history = [_session(i, 20.0 + i * 0.1) for i in range(1, 26)]
        with patch("app.services.price_band_service.get_history", return_value=history):
            r = client.get("/api/stock-detail/FPT/price-band", headers=auth(user_token))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["engine"] == "heuristic"
        assert body["symbol"] == "FPT"
