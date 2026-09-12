"""Đo bằng chứng cho lớp khuyến nghị minh bạch.

Ghi ra ``backend/data/recommendation_evidence.json``. Lớp khuyến nghị trên giao
diện không được tự tuyên bố điều gì: mỗi con số nó hiện ra phải đọc từ file này,
và file này được sinh ra bằng cách chấm **mô hình đang chạy** (V56, đã đóng băng)
trên các bài năm 2026 mà mô hình chưa từng thấy, rồi đối chiếu với diễn biến giá
thật.

Vì sao cần phép đo này
======================
Thiết kế ban đầu định hiện "lợi nhuận kỳ vọng sau phí" cho từng bài, tính bằng
Σ P(lớp) × mức biến động trung bình lịch sử của lớp − phí. Đo trên 2026 cho thấy
con số đó **không mang thông tin**: nhóm được dự báo có lời thực tế lỗ, khoảng
tin cậy nằm hoàn toàn dưới 0, tương quan hạng với thực tế xấp xỉ 0. Nếu không đo
thì giao diện sẽ hiện cho người dùng một con số dương, và họ lỗ khi làm theo.

Phép đo giữ lại những gì mô hình **thật sự làm được** và ghi rõ những gì nó
**không làm được** (đoán chiều, dự báo lợi nhuận).

Về đặc trưng
============
Đặc trưng phải được tính **đúng như lúc web chấm**: cửa sổ 20 phiên kết thúc ở
phiên TRƯỚC ngày đăng (``score_article_url``: ``date < published``) — cũng là
quy tắc của bảng huấn luyện V56.

Bản đầu của script này mượn ``build_features`` của V76 với ngày đăng nguyên
trạng. Hàm đó neo vào phiên cuối ≤ ngày nó nhận, nên với bài đăng vào ngày giao
dịch, cửa sổ chứa luôn phiên của chính ngày đăng — thứ web không bao giờ có lúc
chấm. Mọi con số của bản đầu vì vậy mô tả một mô hình được cho xem nhiều hơn mô
hình thật. Nay script đưa hàm đó ngày hôm trước, rồi đối chiếu với đúng đường
chấm của web trên một mẫu bài; không khớp thì dừng, không ghi file.

Về dữ liệu
==========
Tập 2026 đã được thí nghiệm V76 đọc; ngân sách xác nhận của nó đã tiêu. Script
này KHÔNG dùng tập đó để chọn mô hình hay chỉnh tham số — mô hình đã đóng băng từ
trước. Nó chỉ mô tả mô hình đóng băng làm được gì trên dữ liệu nó chưa từng thấy.
Các mốc chia mức biến động là số tròn khai báo sẵn bên dưới, không được dò từ dữ
liệu.

Chạy (cần repo nghiên cứu, vì tập 2026 không nằm trong bản mô hình đóng gói):

    FINNEXUS_RESEARCH_ROOT="D:/Coder/FinNexus KG" python -m tools.measure_recommendation_evidence
"""

from __future__ import annotations

import datetime as dt
import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

BACKEND = Path(__file__).resolve().parents[1]
OUT_PATH = BACKEND / "data" / "recommendation_evidence.json"

# Phí mua + bán mà mọi thí nghiệm tầng quyết định của dự án đã dùng
# (round_trip_cost trong config V51/V57/V60). Dùng lại đúng con số đó để các
# kết luận ở đây so được với các thí nghiệm trước.
ROUND_TRIP_COST = 0.005

# Ngưỡng "biến động mạnh": |lợi suất vượt thị trường 3 phiên| ≥ 2%, tức đúng ranh
# giới giữa NEUTRAL và hai lớp còn lại của mô hình (frozen_threshold = 0,02).
LARGE_MOVE = 0.02

# Mốc chia mức biến động, trên xác suất mô hình gán cho "biến động mạnh"
# (1 − P(NEUTRAL)). Số tròn khai báo trước, KHÔNG dò từ dữ liệu.
BAND_EDGES = (0.60, 0.75)
BAND_NAMES = ("LOW", "MEDIUM", "HIGH")

# Đối chiếu với đường chấm của web: bao nhiêu bài, và phải khớp tới đâu.
PARITY_SAMPLE = 200
PARITY_TOLERANCE = 1e-6
PARITY_MINIMUM = 0.999


def research_root() -> Path:
    raw = os.environ.get("FINNEXUS_RESEARCH_ROOT") or os.environ.get("FINNEXUS_ROOT") or ""
    root = Path(raw) if raw else None
    if root is None or not (root / "data" / "prospective_2026").is_dir():
        raise SystemExit(
            "Cần repo nghiên cứu có data/prospective_2026. Đặt FINNEXUS_RESEARCH_ROOT, "
            "ví dụ: FINNEXUS_RESEARCH_ROOT=\"D:/Coder/FinNexus KG\""
        )
    return root


def cluster_ci(values: np.ndarray, groups: np.ndarray, n: int = 5000, seed: int = 20260911):
    """KTC 95% cho giá trị trung bình, lấy mẫu lại theo BÀI BÁO.

    Các cặp cùng một bài dùng chung một ngày đăng và một bối cảnh thị trường, nên
    lấy mẫu lại theo dòng sẽ làm khoảng hẹp đi một cách giả tạo — quy ước này
    giống mọi phép so trong dự án.
    """
    if len(values) == 0:
        return [None, None]
    rng = np.random.default_rng(seed)
    uniq = np.unique(groups)
    rows_by = {g: np.flatnonzero(groups == g) for g in uniq}
    means = np.empty(n)
    for i in range(n):
        pick = rng.choice(uniq, size=len(uniq), replace=True)
        means[i] = values[np.concatenate([rows_by[g] for g in pick])].mean()
    lo, hi = np.percentile(means, [2.5, 97.5])
    return [round(float(lo), 5), round(float(hi), 5)]


def scorer_parity(root: Path, rel: pd.DataFrame, matrix: np.ndarray, complete: np.ndarray,
                  window: int, seed: int = 20260911) -> dict:
    """So đặc trưng vừa dựng với đúng các hàm web dùng khi chấm, trên một mẫu bài."""
    from scripts.inference.score_article_url import (
        Refusal, load_price_history, market_features, read_price_panels,
    )

    inference = yaml.safe_load(
        (root / "config/inference_article_scoring_v1.yaml").read_text(encoding="utf-8"))
    paths = [root / p for p in inference["features"]["prices"]]
    panel = read_price_panels(paths)
    indices = pd.concat([pd.read_csv(root / p, low_memory=False)
                         for p in inference["features"]["indices"]],
                        ignore_index=True).drop_duplicates(["index_symbol", "date"])
    indices["date"] = pd.to_datetime(indices["date"], errors="coerce", format="mixed")
    indices = indices.sort_values(["index_symbol", "date"])
    indices["index_return_1d"] = indices.groupby("index_symbol")["close"].transform(
        lambda v: np.log(pd.to_numeric(v, errors="coerce").clip(lower=1e-8)).diff()).fillna(0.0)
    staleness = int(inference["features"]["maximum_price_staleness_days"])

    rng = np.random.default_rng(seed)
    candidates = np.flatnonzero(complete)
    picked = rng.choice(candidates, size=min(PARITY_SAMPLE, len(candidates)), replace=False)
    compared = matched = refused = 0
    for i in picked:
        row = rel.iloc[i]
        try:
            history = load_price_history([row["symbol"]], row["published_date"], window,
                                         paths, staleness, panel=panel)
            rows = history[row["symbol"]]
            index_rows = indices[indices["date"].isin(set(rows["date"]))
                                 & (indices["index_symbol"] == row["index_symbol"])]
            rebuilt = market_features(rows, index_rows)
        except (Refusal, KeyError):
            refused += 1
            continue
        compared += 1
        matched += bool(np.isclose(rebuilt, matrix[i], rtol=0.0, atol=PARITY_TOLERANCE).all())
    return {"rows": compared, "refused_by_scorer": refused,
            "share": round(matched / compared, 4) if compared else None}


def main() -> int:
    root = research_root()
    sys.path.insert(0, str(root))
    from scripts.modeling import evaluate_v76_prospective_2026_confirmation as ev
    from scripts.modeling.train_v53_fixed_threshold_target import LABELS, fixed_threshold_target

    assert LABELS == ["NEGATIVE", "NEUTRAL", "POSITIVE"], LABELS
    config = yaml.safe_load((root / "config/v76_prospective_2026_confirmation_v1.yaml").read_text(encoding="utf-8"))
    frozen = config["frozen_before_data"]
    window = int(config.get("window_sessions", 20))

    # ---- mức biến động trung bình mỗi lớp, CHỈ từ split train ---------------
    table = pd.read_csv(root / "data/lineage/staging/v49_article_type_v1/ranking_table_typed.csv",
                        usecols=["primary_abnormal_return_3d", "split"], low_memory=False)
    table = table[(table["split"] == "train") & np.isfinite(table["primary_abnormal_return_3d"])]
    train_returns = table["primary_abnormal_return_3d"].to_numpy(float)
    train_labels = fixed_threshold_target(train_returns, float(frozen["frozen_threshold"]))
    class_mean = np.array([train_returns[train_labels == k].mean() for k in range(3)])

    # ---- chấm V56 trên 2026, chỉ số theo đúng sàn niêm yết ------------------
    rel = pd.read_csv(root / "data/prospective_2026/prospective_2026_relations.csv", low_memory=False)
    rel["published_date"] = pd.to_datetime(rel["published_date"])
    rel = rel.sort_values(["published_date", "news_id"], kind="stable").reset_index(drop=True)
    prices = pd.read_csv(root / ev.config_price(config), low_memory=False)
    prices["date"] = pd.to_datetime(prices["date"], errors="coerce")
    indices = pd.read_csv(root / "data/reference/v67_current/market_index_history_2023_current.csv",
                          low_memory=False)
    indices["date"] = pd.to_datetime(indices["date"], errors="coerce")
    indices = indices.rename(columns={"index_symbol": "symbol"})
    rel["index_symbol"] = np.where(
        rel["exchange"].astype(str).str.upper().str.contains("HNX"), "HNXINDEX", "VNINDEX")

    # Quy tắc của web: cửa sổ kết thúc TRƯỚC ngày đăng. build_features neo vào
    # phiên cuối ≤ ngày nó nhận, nên đưa nó ngày hôm trước.
    before = rel.assign(published_date=rel["published_date"] - pd.Timedelta(days=1))
    matrix, complete = ev.build_features(before, prices, indices, window)
    for position, column in enumerate(ev.market_feature_columns()):
        rel[column] = matrix[:, position]

    parity = scorer_parity(root, rel, matrix, complete, window)
    if parity["share"] is None or parity["share"] < PARITY_MINIMUM:
        raise SystemExit(f"Đặc trưng không khớp đường chấm của web ({parity}) — dừng, không ghi file.")

    # Nhãn giữ nguyên như V76: lợi suất vượt thị trường 3 phiên tính từ giá đóng
    # cửa ngày đăng — cùng mốc với nhãn huấn luyện của V56.
    abnormal = np.asarray(
        ev.forward_returns(prices, rel[["symbol", "published_date"]], 3)
        - ev.forward_returns(indices, rel[["index_symbol", "published_date"]]
                             .rename(columns={"index_symbol": "symbol"}), 3),
        dtype=float)
    usable = complete & np.isfinite(abnormal)

    contract = json.loads((root / frozen["v56_contract"]).read_text(encoding="utf-8"))
    models = ev.load_models(contract, root / "outputs/model_experiments/v56_deployable_model_v1/artifacts")
    features = rel.loc[usable, contract["feature_contract"]["columns"]].to_numpy(float)
    proba = np.mean([m.predict_proba(features) for m in models], axis=0)
    realised = abnormal[usable]
    articles = rel.loc[usable, "news_id"].astype(str).to_numpy()
    dates = rel.loc[usable, "published_date"]

    # V76 chấm cùng các bài này nhưng với đặc trưng có phiên ngày đăng. Ghi lại
    # bao nhiêu dự đoán còn giống, để thấy chỗ lệch đó lớn tới đâu.
    saved = pd.read_csv(root / "outputs/model_experiments/v76_prospective_2026_confirmation_v1/"
                               "prospective_2026_predictions.csv")
    v76_agreement = (round(float((saved["prediction_v56_market"].to_numpy() == proba.argmax(1)).mean()), 4)
                     if len(saved) == len(proba) else None)

    # ---- 1. Mức biến động ---------------------------------------------------
    p_large = 1.0 - proba[:, 1]
    is_large = np.abs(realised) >= LARGE_MOVE
    band = np.digitize(p_large, BAND_EDGES)
    bands = []
    for k, name in enumerate(BAND_NAMES):
        m = band == k
        bands.append({
            "band": name,
            "from": ([0.0] + list(BAND_EDGES))[k],
            "to": (list(BAND_EDGES) + [1.0])[k],
            "pairs": int(m.sum()),
            "model_probability_mean": round(float(p_large[m].mean()), 4) if m.any() else None,
            "realised_large_move_share": round(float(is_large[m].mean()), 4) if m.any() else None,
        })
    # Phán quyết theo số đo: xếp hạng được khi tỷ lệ thực tế tăng dần qua các mức;
    # "phóng đại" khi xác suất mô hình trung bình cao hơn tỷ lệ thực tế.
    filled = [b for b in bands if b["pairs"]]
    shares = [b["realised_large_move_share"] for b in filled]
    ranks = len(shares) >= 2 and all(a < b for a, b in zip(shares, shares[1:]))
    overstates = ranks and float(np.mean([b["model_probability_mean"] - b["realised_large_move_share"]
                                          for b in filled])) > 0
    magnitude_verdict = ("RANKS_WELL_BUT_OVERSTATES_LEVEL" if overstates
                         else "RANKS_WELL" if ranks else "DOES_NOT_RANK")

    # ---- 2. Chiều: đoán đúng bao nhiêu khi giá THẬT SỰ biến động mạnh -------
    leans_up = proba[:, 2] >= proba[:, 0]
    went_up = realised > 0
    hit = leans_up[is_large] == went_up[is_large]
    large_mean_abs = float(np.abs(realised[is_large]).mean())
    # Lãi (2h − 1)·A − phí ≥ 0  ⇒  h ≥ 0,5 + phí / (2A), A = độ lớn trung bình.
    break_even = 0.5 + ROUND_TRIP_COST / (2 * large_mean_abs)
    hit_high = leans_up[is_large & (band == 2)] == went_up[is_large & (band == 2)]

    # ---- 3. Lợi nhuận kỳ vọng: mô hình KHÔNG làm được ----------------------
    expected_net = proba @ class_mean - ROUND_TRIP_COST
    realised_net = realised - ROUND_TRIP_COST
    positive = expected_net > 0
    quintiles = pd.qcut(expected_net, 5, labels=False, duplicates="drop")
    buckets = [{
        "expected_net_mean": round(float(expected_net[quintiles == k].mean()), 5),
        "realised_net_mean": round(float(realised_net[quintiles == k].mean()), 5),
        "pairs": int((quintiles == k).sum()),
    } for k in range(int(quintiles.max()) + 1)]
    spearman = float(pd.Series(expected_net).corr(pd.Series(realised), method="spearman"))
    positive_ci = cluster_ci(realised_net[positive], articles[positive])

    evidence = {
        "version": "RECOMMENDATION_EVIDENCE_V2",
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "model_version": contract.get("version"),
        "data": {
            "description": "Bài 2026 mô hình chưa từng thấy, chấm bằng mô hình đã đóng băng; "
                           "chỉ số theo đúng sàn niêm yết",
            "pairs": int(len(realised)),
            "articles": int(len(set(articles))),
            "date_range": [str(dates.min().date()), str(dates.max().date())],
            "used_for_model_selection": False,
        },
        "feature_rule": {
            "window_ends": "phiên cuối cùng TRƯỚC ngày đăng — đúng như web chấm và như bảng huấn luyện V56",
            "scorer_parity": parity,
            "agreement_with_v76_predictions": v76_agreement,
            "supersedes": "RECOMMENDATION_EVIDENCE_V1 đo trên đặc trưng có cả phiên ngày đăng",
        },
        "round_trip_cost": ROUND_TRIP_COST,
        "large_move_threshold": LARGE_MOVE,
        "magnitude": {
            "verdict": magnitude_verdict,
            "base_rate": round(float(is_large.mean()), 4),
            "band_edges": list(BAND_EDGES),
            "bands": bands,
        },
        "direction": {
            "verdict": "BELOW_BREAK_EVEN" if float(hit.mean()) < break_even else "AT_OR_ABOVE_BREAK_EVEN",
            "large_move_pairs": int(is_large.sum()),
            "hit_rate": round(float(hit.mean()), 4),
            "hit_rate_high_band": round(float(hit_high.mean()), 4) if hit_high.size else None,
            "high_band_large_move_pairs": int(hit_high.size),
            "break_even_hit_rate": round(float(break_even), 4),
            "large_move_mean_abs": round(large_mean_abs, 4),
        },
        "expected_return": {
            "verdict": "NOT_PREDICTIVE",
            "method": "Σ P(lớp) × lợi suất vượt thị trường trung bình của lớp đó (split train) − phí",
            "class_mean_train": {name: round(float(v), 5) for name, v in zip(LABELS, class_mean)},
            "quintiles": buckets,
            "spearman_with_realised": round(spearman, 4),
            "predicted_positive": {
                "pairs": int(positive.sum()),
                "articles": int(len(set(articles[positive]))),
                "realised_net_mean": round(float(realised_net[positive].mean()), 5),
                "realised_net_ci95": positive_ci,
            },
        },
    }

    # Kết luận không được viết sẵn: nếu một ngày chiều biến động vượt điểm hoà
    # vốn hoặc nhóm "có lời" thật sự có lời, phán quyết phải tự đổi theo số đo.
    if positive_ci[0] is not None and positive_ci[0] > 0 and abs(spearman) >= 0.05:
        evidence["expected_return"]["verdict"] = "PREDICTIVE_ON_2026"

    OUT_PATH.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(evidence, ensure_ascii=False, indent=2))
    print(f"\nĐã ghi {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
