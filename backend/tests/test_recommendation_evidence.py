"""Lớp khuyến nghị chỉ được nói điều đã đo.

Giao diện đọc phán quyết ("không có lời", "dưới điểm hoà vốn") từ file bằng chứng
thay vì viết cứng. Các test dưới đây buộc từng phán quyết khớp với chính con số
đi kèm nó, để một lần sửa tay file JSON — hoặc một lỗi trong công cụ đo — không
thể khiến giao diện tuyên bố "có lời" khi số đo nói ngược lại.
"""

import json
from pathlib import Path

import pytest

from app.services import finnexus_service

EVIDENCE = Path(__file__).resolve().parents[1] / "data" / "recommendation_evidence.json"


@pytest.fixture
def evidence():
    if not EVIDENCE.is_file():
        pytest.skip("Chưa có file bằng chứng — chạy tools.measure_recommendation_evidence")
    return json.loads(EVIDENCE.read_text(encoding="utf-8"))


def test_evidence_was_not_used_to_choose_the_model(evidence):
    assert evidence["data"]["used_for_model_selection"] is False


def test_expected_return_verdict_matches_its_own_numbers(evidence):
    block = evidence["expected_return"]
    low, _ = block["predicted_positive"]["realised_net_ci95"]
    predictive = low is not None and low > 0 and abs(block["spearman_with_realised"]) >= 0.05
    assert (block["verdict"] == "PREDICTIVE_ON_2026") == predictive


def test_direction_verdict_matches_its_own_numbers(evidence):
    block = evidence["direction"]
    assert (block["verdict"] == "BELOW_BREAK_EVEN") == (
        block["hit_rate"] < block["break_even_hit_rate"]
    )


def test_bands_cover_the_whole_range_without_gaps(evidence):
    bands = evidence["magnitude"]["bands"]
    assert [b["band"] for b in bands] == ["LOW", "MEDIUM", "HIGH"]
    assert bands[0]["from"] == 0.0 and bands[-1]["to"] == 1.0
    for left, right in zip(bands, bands[1:]):
        assert left["to"] == right["from"]


def test_missing_evidence_means_no_panel(tmp_path, monkeypatch):
    """Không có file thì trả None — giao diện dựa vào đó để KHÔNG hiện gì, thay
    vì hiện một con số mặc định không ai đo."""
    monkeypatch.setattr(finnexus_service, "_EVIDENCE_PATH", tmp_path / "missing.json")
    assert finnexus_service.recommendation_evidence() is None
