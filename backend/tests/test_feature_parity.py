"""Lúc chấm bài thật có tính ra đúng 33 con số như lúc huấn luyện không?

Vì sao cần bộ test này
======================
Mô hình được huấn luyện từ một bảng CSV đã dựng sẵn
(``ranking_table_typed.csv``, các cột ``market_00``…``market_32``). Khi chấm một
bài mới, những con số đó lại được tính bằng một đoạn mã **hoàn toàn khác**:
``market_features()`` trong ``scripts/inference/score_article_url.py``.

Hai đường mã, cùng phải cho ra 33 số theo cùng một thứ tự. Cho tới trước bộ test
này, thứ duy nhất buộc chúng khớp nhau là *hợp đồng cột* trong
``model_contract.json`` — một lời hứa, không phải một phép đo. Nếu chúng lệch
nhau, mô hình sẽ chấm bằng những đặc trưng nó chưa từng học, và **không có gì
báo lỗi**: kết quả vẫn là ba con số xác suất trông hoàn toàn bình thường.

Đây đúng là loại lỗi mà kiểm định V76 đã ghi tên: bộ chẩn đoán C4 đẩy chính bài
của bảng huấn luyện qua đường suy luận, nên nó không thấy được một đặc trưng chỉ
hỏng khi gặp dữ liệu có hình dạng khác.

Bộ test làm gì
==============
Lấy vài dòng thật từ bảng huấn luyện, dựng lại đặc trưng bằng đường suy luận từ
chính lịch sử giá, rồi so từng số với giá trị đã lưu trong bảng.

Bỏ qua khi không có mô hình (``FINNEXUS_ROOT`` trống) — CI cố ý chạy không có
mô hình, xem ghi chú trong ``.github/workflows/ci.yml``.
"""

import csv
import os
import sys

import pytest

pytestmark = pytest.mark.parity

csv.field_size_limit(10 ** 7)

# Sai khác cho phép giữa hai đường tính. Không đặt 0: hai đường đi qua các phép
# cộng dồn dấu phẩy động theo thứ tự khác nhau, nên chênh lệch cỡ 1e-9 là bình
# thường. Đặt ở 1e-6 thì vẫn đủ chặt để bắt mọi lỗi thật — lệch cột, sai thứ tự,
# nhầm cửa sổ đều tạo sai khác lớn hơn nhiều bậc.
TOLERANCE = 1e-6

TABLE_RELATIVE = os.path.join(
    "data", "lineage", "staging", "v49_article_type_v1", "ranking_table_typed.csv"
)


@pytest.fixture(scope="module")
def resources():
    """Bật mô hình trong phạm vi module này, rồi trả hệ thống về nguyên trạng.

    conftest cố ý để ``FINNEXUS_ROOT`` trống cho toàn bộ test, và giữ giá trị
    gốc ở ``FINNEXUS_PARITY_ROOT``. Ta mượn lại đúng ở đây, rồi hoàn trả trong
    phần dọn dẹp — nếu không, một test chạy sau sẽ bất ngờ thấy mô hình khả
    dụng và kiểm sai đường dẫn nó định kiểm.
    """
    root = (os.environ.get("FINNEXUS_PARITY_ROOT") or "").strip()
    if not root or not os.path.isdir(root):
        pytest.skip(
            "Đặt FINNEXUS_ROOT trỏ tới bản mô hình để chạy kiểm tra đối chiếu"
        )

    from app.core.config import settings
    from app.services import finnexus_service

    previous = settings.FINNEXUS_ROOT
    settings.FINNEXUS_ROOT = root
    finnexus_service.reset()
    try:
        try:
            state = finnexus_service._ensure_loaded()
        except finnexus_service.ModelUnavailable as exc:
            pytest.skip(f"Không nạp được mô hình: {exc}")
        yield root, state
    finally:
        settings.FINNEXUS_ROOT = previous
        finnexus_service.reset()


@pytest.fixture(scope="module")
def rows(resources):
    """Vài dòng thật từ bảng huấn luyện, mỗi dòng một mã khác nhau.

    Lấy mã khác nhau chứ không lấy các dòng liền kề: các dòng liền kề thường
    thuộc cùng một bài, nên chúng dùng chung một cửa sổ giá và sẽ không phát
    hiện được lỗi chỉ xuất hiện ở một mã nhất định.
    """
    root, _ = resources
    path = os.path.join(root, TABLE_RELATIVE)
    if not os.path.isfile(path):
        pytest.skip(f"Không tìm thấy bảng huấn luyện: {path}")

    picked, seen = [], set()
    with open(path, "r", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            symbol = row["symbol"]
            if symbol in seen:
                continue
            seen.add(symbol)
            picked.append(row)
            if len(picked) >= 12:
                break
    assert picked, "Bảng huấn luyện rỗng"
    return picked


def _feature_columns(state):
    return state["resources"]["contract"]["feature_contract"]["columns"]


def test_contract_declares_thirty_three_features(resources):
    """Hợp đồng phải khai đúng số cột mà mô hình được huấn luyện với."""
    _, state = resources
    contract = state["resources"]["contract"]["feature_contract"]
    assert contract["count"] == len(contract["columns"]) == 33


def test_training_table_has_every_contract_column(resources, rows):
    """Mọi cột trong hợp đồng phải tồn tại trong bảng huấn luyện.

    Thiếu một cột ở đây nghĩa là hợp đồng và bảng đã trôi khỏi nhau, và mọi
    phép so ở test dưới sẽ so nhầm cột.
    """
    _, state = resources
    missing = [c for c in _feature_columns(state) if c not in rows[0]]
    assert not missing, f"Bảng huấn luyện thiếu cột: {missing}"


def test_inference_rebuilds_the_stored_feature_vector(resources, rows):
    """Đường suy luận phải dựng lại đúng 33 số đã lưu trong bảng huấn luyện.

    Đây là phép kiểm cốt lõi. Nó chạy lại toàn bộ đường tính đặc trưng lúc suy
    luận — đọc bảng giá, cắt cửa sổ 20 phiên, dựng 8 chỉ số, tóm tắt 4 cách —
    rồi so từng số với giá trị bảng huấn luyện đã ghi cho chính dòng đó.
    """
    root, state = resources
    sys.path.insert(0, root)
    from scripts.inference.score_article_url import (  # noqa: E402
        Refusal, index_for, load_price_history, market_features,
    )

    import pandas as pd  # noqa: E402

    config = state["config"]
    columns = _feature_columns(state)
    window = int(config["features"]["window_sessions"])
    price_paths = [
        (os.path.join(root, p)) for p in (
            config["features"]["prices"]
            if isinstance(config["features"]["prices"], list)
            else [config["features"]["prices"]]
        )
    ]
    indices = state["resources"]["indices"]

    compared = 0
    skipped = []

    for row in rows:
        symbol = row["symbol"]
        published = pd.to_datetime(row["published_date"], errors="coerce")
        if pd.isna(published):
            skipped.append((symbol, "ngày đăng không đọc được"))
            continue

        try:
            history = load_price_history(
                [symbol], published, window,
                [pd.io.common.Path(p) for p in price_paths],
                int(config["features"]["maximum_price_staleness_days"]),
                panel=state["resources"]["prices"],
            )
        except Refusal as refusal:
            # Từ chối là kết quả hợp lệ (bài quá cũ, thiếu phiên). Không phải
            # lỗi đối chiếu, nên ghi lại rồi bỏ qua dòng này.
            skipped.append((symbol, refusal.reason))
            continue

        if symbol not in history:
            skipped.append((symbol, "không đủ lịch sử giá"))
            continue

        price_rows = history[symbol]
        # Lọc đúng chỉ số của sàn niêm yết, y như score_article làm. Chính bộ
        # test này đã phát hiện ra rằng trước đây bước lọc đó không tồn tại:
        # mọi cổ phiếu HNX bị chấm bằng VN-Index, làm lệch 8 trong 33 đặc trưng.
        index_rows = indices[
            (indices["date"].isin(set(price_rows["date"])))
            & (indices["index_symbol"] == index_for(symbol, state["resources"]["dictionary"]))
        ]
        try:
            rebuilt = market_features(price_rows, index_rows)
        except Refusal as refusal:
            skipped.append((symbol, refusal.reason))
            continue

        # market_features trả về 32 số; cột thứ 33 là cờ hình dạng bài, do bước
        # phân loại sinh ra chứ không phải từ giá.
        for position, column in enumerate(columns[:32]):
            stored = row.get(column, "")
            if stored in ("", None):
                continue
            expected = float(stored)
            actual = float(rebuilt[position])
            assert abs(actual - expected) <= TOLERANCE, (
                f"{symbol} · {column} (vị trí {position}): "
                f"bảng huấn luyện ghi {expected!r}, đường suy luận tính {actual!r}. "
                f"Hai đường đã trôi khỏi nhau — mô hình đang chấm bằng đặc trưng "
                f"nó chưa từng học."
            )
        compared += 1

    assert compared > 0, (
        "Không đối chiếu được dòng nào. Lý do bỏ qua: "
        + "; ".join(f"{s}: {r}" for s, r in skipped)
    )


def test_feature_order_is_pinned_not_alphabetical(resources):
    """Thứ tự cột phải là thứ tự đã ghim, không phải thứ tự tình cờ.

    ``market_00``…``market_31`` sắp theo (phép tóm tắt, chỉ số): tám số đầu là
    phiên gần nhất, tám số tiếp là trung bình, rồi độ lệch chuẩn, rồi biên độ.
    Nếu ai đó sắp lại danh sách này cho "gọn", mô hình sẽ nhận đúng 32 số nhưng
    ở sai vị trí, và không có gì báo lỗi.
    """
    _, state = resources
    columns = _feature_columns(state)
    assert columns[:32] == [f"market_{i:02d}" for i in range(32)]
    assert columns[32] == "market_wide_title"
