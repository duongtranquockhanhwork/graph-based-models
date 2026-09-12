"""Bảng "mua ở giá nào thì được gì" đi kèm web phải tự nhất quán.

Số liệu do repo nghiên cứu sinh ra (build_v89_entry_ladder.py); ở đây chỉ kiểm
những tính chất mà một bảng đúng không thể vi phạm, để một file hỏng hay bị sửa
tay không lọt ra giao diện.
"""

import pytest

from app.services import finnexus_service as fs


@pytest.fixture(scope="module")
def ladder():
    data = fs.entry_ladder()
    if data is None:
        pytest.skip("Chưa có backend/data/entry_ladder.json")
    return data


def test_the_ladder_says_what_it_is(ladder):
    assert ladder["is_investment_advice"] is False
    assert ladder["validation"]["checked_on"] == "2026"
    assert "ALL" in ladder["cells"]


def test_fill_rates_are_probabilities_and_fall_as_the_order_goes_lower(ladder):
    for name, cell in ladder["cells"].items():
        ordered = sorted(cell["levels"].items(), key=lambda kv: -float(kv[0]))
        rates = [v["fill_rate"] for _, v in ordered if v.get("fill_rate") is not None]
        assert all(0.0 <= r <= 1.0 for r in rates), name
        # Một lệnh thấp hơn chỉ khớp khi lệnh cao hơn cũng đã khớp.
        assert all(a >= b for a, b in zip(rates, rates[1:])), name


def test_every_cell_the_panel_can_pick_exists(ladder):
    for vol in ("LOW", "MID", "HIGH"):
        assert f"VOL_{vol}" in ladder["cells"]
        for band in ("LOW", "MEDIUM", "HIGH"):
            assert f"VOL_{vol}|BAND_{band}" in ladder["cells"]
