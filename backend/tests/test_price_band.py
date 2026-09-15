"""Vùng giá tham khảo (price_band_service) — quy tắc thống kê mô tả, không
phải dự đoán. Test này khoá lại các bất biến mà một vùng giá đúng không được
vi phạm, rằng router trả 404 rõ ràng khi không đủ dữ liệu, rằng giá lấy từ bảng
giá của mô hình được đổi đúng sang đồng, và rằng mốc chờ giảm về luôn đi kèm số
liệu đã kiểm chứng cho đúng mức đặt lệnh gần nhất.
"""

from unittest.mock import patch

import pandas as pd

from app.services import finnexus_service, price_band_service
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


STUB_LADDER = {
    "levels": [0.0, -0.01, -0.02, -0.03, -0.05],
    "volatility_cuts": [0.01, 0.03],
    "sessions": 3,
    "round_trip_cost": 0.005,
    "validation": {"trained_until": "2025-12-31", "checked_on": "2026"},
    "cells": {
        "ALL": {
            "events": 1000, "reliable": True,
            "market_at_next_open": {"mean_net_if_filled": -0.007},
            "levels": {"0.0": {"fill_rate": 0.9, "mean_net_if_filled": -0.007}},
        },
        "VOL_MID": {
            "events": 400, "reliable": True,
            "market_at_next_open": {"mean_net_if_filled": -0.006},
            "levels": {
                "0.0": {"fill_rate": 0.92, "mean_net_if_filled": -0.0065},
                "-0.05": {"fill_rate": 0.21, "mean_net_if_filled": -0.0013},
            },
        },
    },
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
        assert band["price_source"] == "vnstock"  # bộ test chạy không có mô hình
        assert band["price_unit"] == "VND"
        assert band["current_price"] == history[-1]["close"]
        # Vùng giá không được rộng hơn biên độ thật sự quan sát được.
        assert band["range_low"] <= band["current_price"] <= band["range_high"]
        # Mốc "chờ giá giảm về" không được thấp hơn mức thấp nhất đã quan sát.
        assert band["pullback_reference_price"] >= band["range_low"]
        assert band["pullback_reference_price"] <= band["current_price"]
        assert band["daily_volatility_pct"] >= 0
        assert "disclaimer" in band and "KHÔNG" in band["disclaimer"]

    def test_zero_volatility_pulls_back_to_current_price(self):
        # Giá đứng yên tuyệt đối -> độ lệch chuẩn lợi suất = 0 -> mốc "chờ giảm
        # về" trùng giá hiện tại (không có gì để chờ).
        history = [_session(i, 20.0, low=19.5, high=20.5) for i in range(1, 26)]
        with patch("app.services.price_band_service.get_history", return_value=history):
            band = price_band_service.compute_price_band("FPT")

        assert band["daily_volatility_pct"] == 0
        assert band["pullback_reference_price"] == band["current_price"]

    def test_model_panel_is_preferred_and_converted_to_vnd(self):
        """Cùng một bảng giá với mô hình, đổi từ nghìn đồng sang đồng."""
        dates = pd.bdate_range("2026-08-03", periods=25)
        panel = pd.DataFrame({
            "symbol": "FPT", "date": dates, "open": 72.0, "high": 73.0, "low": 71.0,
            "close": [72.0 + (i % 2) * 0.5 for i in range(25)], "volume": 1e6,
        })
        state = {"resources": {"prices": panel, "live": None}}
        with patch.object(finnexus_service, "_ensure_loaded", return_value=state), \
                patch("app.services.price_band_service.get_history") as vnstock:
            band = price_band_service.compute_price_band("FPT")
        vnstock.assert_not_called()
        assert band["price_source"] == "model_panel"
        assert band["current_price"] == panel["close"].iloc[-1] * 1000
        assert band["range_high"] == 73000.0 and band["range_low"] == 71000.0
        assert band["as_of_session"] == str(dates[-1].date())

    def test_pullback_comes_with_the_validated_entry_statistic(self):
        # Lợi suất log xen kẽ +-0,02 -> độ biến động ~2,05% (nhóm MID với mốc
        # cắt 1%/3%) -> mốc chờ giảm ~-4,1% -> mức đặt lệnh gần nhất là -5%.
        closes = [100.0 if i % 2 == 0 else 100.0 * 1.0202013 for i in range(25)]
        history = [
            {"time": f"2026-08-{i + 1:02d}", "open": c, "close": c, "low": c * 0.9, "high": c * 1.05}
            for i, c in enumerate(closes)
        ]
        with patch("app.services.price_band_service.get_history", return_value=history), \
                patch.object(finnexus_service, "entry_ladder", return_value=STUB_LADDER):
            band = price_band_service.compute_price_band("FPT")
        entry = band["validated_entry"]
        assert entry["volatility_group"] == "MID"
        assert entry["order_level"] == -0.05
        assert entry["fill_rate"] == 0.21
        assert entry["mean_net_if_filled"] == -0.0013
        assert entry["checked_on"] == "2026"

    def test_no_ladder_means_no_validated_entry(self):
        history = [_session(i, 20.0 + i * 0.1) for i in range(1, 26)]
        with patch("app.services.price_band_service.get_history", return_value=history), \
                patch.object(finnexus_service, "entry_ladder", return_value=None):
            band = price_band_service.compute_price_band("FPT")
        assert band["validated_entry"] is None


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
        assert body["price_unit"] == "VND"
