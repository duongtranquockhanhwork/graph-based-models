"""Evaluate FinNexus semantic/entity labels against the frozen Gold holdout.

This script deliberately separates:

1. candidate entity-link precision, which is directly estimable from the
   stratified Gold relation sample; and
2. a reproducible benchmark of the historical ``WEAK_RULE_V1`` labeler.

The current graph contains ``WEAK_RULE_V3_ENTITY_TIERED`` edges. The original
pre-review V3 predictions were not retained in the frozen Gold workbook, so a
V1 benchmark must never be presented as direct validation of V3.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import re
from pathlib import Path
from typing import Any, Callable

import numpy as np
import pandas as pd
import yaml
from sklearn.metrics import (
    accuracy_score,
    cohen_kappa_score,
    f1_score,
    matthews_corrcoef,
    precision_recall_fscore_support,
)


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PROTOCOL = ROOT / "config" / "kg_evaluation_protocol.yaml"
DEFAULT_OUTPUT = ROOT / "outputs" / "kg_evaluation_v1"
HISTORICAL_RULES = (
    ROOT / "scripts" / "preprocessing" / "prepare_historical_dataset.py"
)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_protocol(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        protocol = yaml.safe_load(handle)
    if not isinstance(protocol, dict):
        raise ValueError("Protocol YAML must contain a mapping")
    return protocol


def load_historical_rules() -> Any:
    spec = importlib.util.spec_from_file_location(
        "finnexus_historical_rules", HISTORICAL_RULES
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot import historical rules: {HISTORICAL_RULES}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def as_bool(series: pd.Series) -> pd.Series:
    return (
        series.astype(str)
        .str.strip()
        .str.casefold()
        .isin({"true", "1", "yes"})
    )


def wilson_interval(successes: int, total: int, z: float = 1.9599639845) -> tuple[float, float]:
    if total <= 0:
        return math.nan, math.nan
    proportion = successes / total
    denominator = 1.0 + z * z / total
    centre = proportion + z * z / (2.0 * total)
    margin = z * math.sqrt(
        (proportion * (1.0 - proportion) + z * z / (4.0 * total)) / total
    )
    return (centre - margin) / denominator, (centre + margin) / denominator


def group_bootstrap_interval(
    frame: pd.DataFrame,
    metric: Callable[[pd.DataFrame], float],
    iterations: int,
    seed: int,
) -> tuple[float, float]:
    groups = frame["news_id"].astype(str).unique()
    by_group = {
        group: frame.loc[frame["news_id"].astype(str).eq(group)]
        for group in groups
    }
    rng = np.random.default_rng(seed)
    values: list[float] = []
    for _ in range(iterations):
        sampled = rng.choice(groups, size=len(groups), replace=True)
        resample = pd.concat([by_group[group] for group in sampled], ignore_index=True)
        values.append(float(metric(resample)))
    return tuple(np.quantile(values, [0.025, 0.975]).tolist())


def weighted_accuracy(frame: pd.DataFrame) -> float:
    weights = pd.to_numeric(frame["sampling_weight"], errors="coerce").fillna(1.0)
    correct = frame["symbol_correct"].eq("YES").astype(float)
    return float(np.average(correct, weights=weights))


def make_rule_predictions(gold: pd.DataFrame, rules: Any) -> pd.DataFrame:
    predictions = gold.copy()
    detail: list[str] = []
    event: list[str] = []
    sentiment: list[str] = []
    confidence: list[str] = []
    scope: list[str] = []
    impact: list[str] = []

    symbols_per_news = (
        predictions.groupby("news_id")["symbol"].transform("nunique").astype(int)
    )
    for position, (_, row) in enumerate(predictions.iterrows()):
        title = str(row.get("title", ""))
        content = str(row.get("content_preview", ""))
        event_detail, sentiment_value, score = rules.classify_event_sentiment(
            title, content
        )
        event_value = rules.DETAIL_TO_EVENT_TYPE.get(event_detail, "OTHER")
        confidence_value = rules.confidence_band(score)
        symbol = re.escape(str(row.get("symbol", "")).upper())
        in_title = int(
            bool(re.search(rf"(?<![A-Z0-9]){symbol}(?![A-Z0-9])", title.upper()))
        )
        derived_row = pd.Series(
            {
                "event_type_detail": event_detail,
                "title": title,
                "content": content,
                "n_symbols_in_news": int(symbols_per_news.iloc[position]),
                "in_title": in_title,
            }
        )
        scope_value = rules.derive_affected_scope(derived_row, event_value)
        impact_value = rules.derive_impact_level(
            derived_row, event_value, scope_value, confidence_value
        )
        detail.append(event_detail)
        event.append(event_value)
        sentiment.append(str(sentiment_value).upper())
        confidence.append(confidence_value)
        scope.append(scope_value)
        impact.append(impact_value)

    predictions["rule_event_type_detail"] = detail
    predictions["rule_event_type"] = event
    predictions["rule_sentiment"] = sentiment
    predictions["rule_confidence"] = confidence
    predictions["rule_affected_scope"] = scope
    predictions["rule_impact_level"] = impact
    predictions["evaluated_rule_version"] = "WEAK_RULE_V1_REPRODUCIBLE_BASELINE"
    return predictions


def classification_rows(
    frame: pd.DataFrame,
    task: str,
    truth_column: str,
    prediction_column: str,
    labels: list[str],
    weighted: bool,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    y_true = frame[truth_column].astype(str)
    y_pred = frame[prediction_column].astype(str)
    weights = (
        pd.to_numeric(frame["sampling_weight"], errors="coerce").fillna(1.0)
        if weighted
        else None
    )
    suffix = "sampling_weighted" if weighted else "unweighted"
    rows = [
        {
            "task": task,
            "estimate": suffix,
            "n_relations": len(frame),
            "n_news": frame["news_id"].nunique(),
            "metric": "accuracy",
            "value": accuracy_score(y_true, y_pred, sample_weight=weights),
        },
        {
            "task": task,
            "estimate": suffix,
            "n_relations": len(frame),
            "n_news": frame["news_id"].nunique(),
            "metric": "macro_f1",
            "value": f1_score(
                y_true,
                y_pred,
                labels=labels,
                average="macro",
                zero_division=0,
                sample_weight=weights,
            ),
        },
        {
            "task": task,
            "estimate": suffix,
            "n_relations": len(frame),
            "n_news": frame["news_id"].nunique(),
            "metric": "weighted_f1",
            "value": f1_score(
                y_true,
                y_pred,
                labels=labels,
                average="weighted",
                zero_division=0,
                sample_weight=weights,
            ),
        },
    ]
    # Agreement coefficients do not accept arbitrary sampling weights.
    if not weighted:
        rows.extend(
            [
                {
                    "task": task,
                    "estimate": suffix,
                    "n_relations": len(frame),
                    "n_news": frame["news_id"].nunique(),
                    "metric": "cohen_kappa",
                    "value": cohen_kappa_score(y_true, y_pred, labels=labels),
                },
                {
                    "task": task,
                    "estimate": suffix,
                    "n_relations": len(frame),
                    "n_news": frame["news_id"].nunique(),
                    "metric": "matthews_corrcoef",
                    "value": matthews_corrcoef(y_true, y_pred),
                },
            ]
        )
        if task == "impact_level":
            rows.append(
                {
                    "task": task,
                    "estimate": suffix,
                    "n_relations": len(frame),
                    "n_news": frame["news_id"].nunique(),
                    "metric": "quadratic_weighted_kappa",
                    "value": cohen_kappa_score(
                        y_true,
                        y_pred,
                        labels=["LOW", "MODERATE", "HIGH"],
                        weights="quadratic",
                    ),
                }
            )

    precision, recall, f1, support = precision_recall_fscore_support(
        y_true,
        y_pred,
        labels=labels,
        zero_division=0,
        sample_weight=weights,
    )
    class_rows = [
        {
            "task": task,
            "estimate": suffix,
            "class": label,
            "precision": precision[index],
            "recall": recall[index],
            "f1": f1[index],
            "support": support[index],
        }
        for index, label in enumerate(labels)
    ]
    return rows, class_rows


def metric_value(
    metrics: pd.DataFrame, task: str, metric: str, estimate: str = "unweighted"
) -> float:
    match = metrics.loc[
        metrics["task"].eq(task)
        & metrics["metric"].eq(metric)
        & metrics["estimate"].eq(estimate),
        "value",
    ]
    return float(match.iloc[0]) if len(match) else math.nan


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--protocol", type=Path, default=DEFAULT_PROTOCOL)
    parser.add_argument("--output_dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    protocol = load_protocol(args.protocol)
    holdout_path = ROOT / protocol["scope"]["semantic_holdout"]
    gold = pd.read_csv(holdout_path, dtype=str, keep_default_na=False)
    if gold["holdout_id"].duplicated().any():
        raise ValueError("Duplicate holdout_id in frozen semantic holdout")
    if not gold["ground_truth_role"].eq("EVALUATION_ONLY").all():
        raise ValueError("Semantic holdout is not marked EVALUATION_ONLY")
    rules = load_historical_rules()
    predictions = make_rule_predictions(gold, rules)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    predictions.to_csv(
        args.output_dir / "semantic_rule_v1_predictions.csv",
        index=False,
        encoding="utf-8-sig",
    )

    evaluation = protocol["semantic_evaluation"]
    iterations = int(evaluation["bootstrap_iterations"])
    seed = int(protocol["random_seed"])
    entity = predictions.loc[as_bool(predictions["usable_for_entity_evaluation"])].copy()
    successes = int(entity["symbol_correct"].eq("YES").sum())
    point_precision = successes / len(entity)
    lower, upper = wilson_interval(successes, len(entity))
    bootstrap_lower, bootstrap_upper = group_bootstrap_interval(
        entity,
        lambda sample: float(sample["symbol_correct"].eq("YES").mean()),
        iterations,
        seed,
    )
    weighted_point = weighted_accuracy(entity)
    weighted_lower, weighted_upper = group_bootstrap_interval(
        entity, weighted_accuracy, iterations, seed + 1
    )
    tier_rows: list[dict[str, Any]] = []
    for tier, tier_frame in entity.groupby("entity_tier", sort=True):
        tier_successes = int(tier_frame["symbol_correct"].eq("YES").sum())
        tier_lower, tier_upper = wilson_interval(tier_successes, len(tier_frame))
        tier_rows.append(
            {
                "entity_tier": tier,
                "n_relations": len(tier_frame),
                "n_news": tier_frame["news_id"].nunique(),
                "correct_relations": tier_successes,
                "precision": tier_successes / len(tier_frame),
                "wilson_95_lower": tier_lower,
                "wilson_95_upper": tier_upper,
            }
        )
    tier_metrics = pd.DataFrame(tier_rows)
    tier_metrics.to_csv(
        args.output_dir / "entity_precision_by_tier.csv",
        index=False,
        encoding="utf-8-sig",
    )
    high_precision_row = tier_metrics.loc[
        tier_metrics["entity_tier"].eq("HIGH_PRECISION")
    ]
    if high_precision_row.empty:
        raise ValueError("Gold holdout has no HIGH_PRECISION entity stratum")
    hp_precision = float(high_precision_row["precision"].iloc[0])
    hp_lower = float(high_precision_row["wilson_95_lower"].iloc[0])
    hp_upper = float(high_precision_row["wilson_95_upper"].iloc[0])

    metric_rows: list[dict[str, Any]] = [
        {
            "task": "entity_link_candidate_precision",
            "estimate": "unweighted",
            "n_relations": len(entity),
            "n_news": entity["news_id"].nunique(),
            "metric": "precision",
            "value": point_precision,
            "ci_lower": lower,
            "ci_upper": upper,
            "ci_method": "Wilson 95%",
        },
        {
            "task": "entity_link_candidate_precision",
            "estimate": "unweighted",
            "n_relations": len(entity),
            "n_news": entity["news_id"].nunique(),
            "metric": "group_bootstrap_precision",
            "value": point_precision,
            "ci_lower": bootstrap_lower,
            "ci_upper": bootstrap_upper,
            "ci_method": f"news_id cluster bootstrap n={iterations}",
        },
        {
            "task": "entity_link_candidate_precision",
            "estimate": "sampling_weighted",
            "n_relations": len(entity),
            "n_news": entity["news_id"].nunique(),
            "metric": "precision",
            "value": weighted_point,
            "ci_lower": weighted_lower,
            "ci_upper": weighted_upper,
            "ci_method": f"news_id cluster bootstrap n={iterations}",
        },
    ]
    class_rows: list[dict[str, Any]] = []
    task_specs = [
        (
            "event_type",
            "event_type",
            "rule_event_type",
            "usable_for_content_semantics",
            [
                "MARKET_TRADING",
                "MACRO_POLICY",
                "BUSINESS_RESULT",
                "CORPORATE_ACTION",
                "LEGAL_REGULATORY",
                "M_AND_A",
                "SECTOR_NEWS",
                "OTHER",
            ],
        ),
        (
            "sentiment",
            "sentiment",
            "rule_sentiment",
            "usable_for_content_semantics",
            ["NEGATIVE", "NEUTRAL", "POSITIVE"],
        ),
        (
            "affected_scope",
            "affected_scope",
            "rule_affected_scope",
            "usable_for_stock_linked_semantics",
            ["MARKET", "SECTOR", "STOCK_SPECIFIC"],
        ),
        (
            "impact_level",
            "impact_level",
            "rule_impact_level",
            "usable_for_stock_specific_impact",
            ["LOW", "MODERATE", "HIGH"],
        ),
    ]
    for task, truth, prediction, flag, labels in task_specs:
        subset = predictions.loc[as_bool(predictions[flag])].copy()
        for weighted in (False, True):
            rows, per_class = classification_rows(
                subset, task, truth, prediction, labels, weighted
            )
            metric_rows.extend(rows)
            class_rows.extend(per_class)

    metrics = pd.DataFrame(metric_rows)
    metrics.to_csv(
        args.output_dir / "semantic_metrics.csv",
        index=False,
        encoding="utf-8-sig",
    )
    pd.DataFrame(class_rows).to_csv(
        args.output_dir / "semantic_per_class_metrics.csv",
        index=False,
        encoding="utf-8-sig",
    )

    gates = evaluation["label_quality_gates"]
    entity_gate = evaluation["entity_precision_gate"]
    checks = [
        {
            "check": "high_precision_tier_entity_precision_point",
            "value": hp_precision,
            "threshold": float(entity_gate["point_estimate_min"]),
            "status": "PASS"
            if hp_precision >= float(entity_gate["point_estimate_min"])
            else "FAIL",
        },
        {
            "check": "high_precision_tier_entity_precision_wilson_lower",
            "value": hp_lower,
            "threshold": float(entity_gate["wilson_lower_bound_min"]),
            "status": "PASS"
            if hp_lower >= float(entity_gate["wilson_lower_bound_min"])
            else "FAIL",
        },
        {
            "check": "event_type_macro_f1",
            "value": metric_value(metrics, "event_type", "macro_f1"),
            "threshold": float(gates["event_type_macro_f1_min"]),
        },
        {
            "check": "sentiment_macro_f1",
            "value": metric_value(metrics, "sentiment", "macro_f1"),
            "threshold": float(gates["sentiment_macro_f1_min"]),
        },
        {
            "check": "affected_scope_macro_f1",
            "value": metric_value(metrics, "affected_scope", "macro_f1"),
            "threshold": float(gates["affected_scope_macro_f1_min"]),
        },
        {
            "check": "impact_level_quadratic_kappa",
            "value": metric_value(
                metrics, "impact_level", "quadratic_weighted_kappa"
            ),
            "threshold": float(gates["impact_level_quadratic_kappa_min"]),
        },
    ]
    for check in checks:
        check.setdefault(
            "status",
            "PASS" if check["value"] >= check["threshold"] else "FAIL",
        )
    checks_frame = pd.DataFrame(checks)
    checks_frame.to_csv(
        args.output_dir / "semantic_quality_gates.csv",
        index=False,
        encoding="utf-8-sig",
    )

    summary = {
        "protocol_version": protocol["protocol_version"],
        "holdout_version": protocol["scope"]["semantic_holdout_version"],
        "holdout_sha256": file_sha256(holdout_path),
        "historical_rule_file": str(HISTORICAL_RULES.relative_to(ROOT)),
        "historical_rule_sha256": file_sha256(HISTORICAL_RULES),
        "evaluated_rule_version": "WEAK_RULE_V1_REPRODUCIBLE_BASELINE",
        "current_graph_semantic_rule_version": "WEAK_RULE_V3_ENTITY_TIERED",
        "direct_v3_validation": False,
        "reason_direct_v3_not_validated": (
            "Original pre-review V3 predictions are not present in the frozen "
            "Gold file and V17 has zero holdout overlap."
        ),
        "gold_rows": len(gold),
        "gold_unique_news": gold["news_id"].nunique(),
        "entity_precision": point_precision,
        "entity_precision_wilson_95": [lower, upper],
        "high_precision_tier_entity_precision": hp_precision,
        "high_precision_tier_entity_precision_wilson_95": [hp_lower, hp_upper],
        "sampling_weighted_entity_precision": weighted_point,
        "quality_gates_passed": int(checks_frame["status"].eq("PASS").sum()),
        "quality_gates_failed": int(checks_frame["status"].eq("FAIL").sum()),
        "rare_class_warning": (
            "Per-class estimates for LEGAL_REGULATORY, MACRO_POLICY, M_AND_A "
            "and SECTOR_NEWS are unstable because support is below 10."
        ),
        "entity_recall_limitation": (
            "The relation-candidate holdout estimates link precision, not "
            "article-level entity recall; exhaustive entity annotations are absent."
        ),
    }
    (args.output_dir / "semantic_evaluation_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    key = checks_frame.set_index("check")
    report = [
        "# Đánh giá semantic/entity của FinNexus KG",
        "",
        "## Kết luận",
        "",
        (
            f"- Precision liên kết mã toàn bộ mẫu Gold: **{point_precision:.1%}** "
            f"(Wilson 95% CI: {lower:.1%}–{upper:.1%})."
        ),
        (
            f"- Precision tầng HIGH_PRECISION: **{hp_precision:.1%}** "
            f"(Wilson 95% CI: {hp_lower:.1%}–{hp_upper:.1%})."
        ),
        (
            f"- Ước lượng có trọng số lấy mẫu: **{weighted_point:.1%}** "
            f"(cluster bootstrap: {weighted_lower:.1%}–{weighted_upper:.1%})."
        ),
        (
            f"- Rule V1 đạt event macro-F1 "
            f"**{key.loc['event_type_macro_f1', 'value']:.3f}**, sentiment "
            f"**{key.loc['sentiment_macro_f1', 'value']:.3f}**, affected scope "
            f"**{key.loc['affected_scope_macro_f1', 'value']:.3f}**."
        ),
        (
            f"- Impact level quadratic weighted kappa: "
            f"**{key.loc['impact_level_quadratic_kappa', 'value']:.3f}**."
        ),
        "",
        "## Phạm vi diễn giải",
        "",
        "- Gold là mẫu quan hệ news–symbol nên đo được precision của candidate link, chưa đo được recall entity toàn bài.",
        "- Benchmark nhãn dùng WEAK_RULE_V1 đã có trước Gold; không phải phép kiểm định trực tiếp WEAK_RULE_V3_ENTITY_TIERED trong graph hiện tại.",
        "- Các lớp LEGAL_REGULATORY, MACRO_POLICY, M_AND_A và SECTOR_NEWS có dưới 10 mẫu, không đủ cho tuyên bố hiệu năng ổn định theo lớp.",
        "- Holdout chỉ dùng đánh giá; không dùng sửa rule, chọn threshold hay train mô hình.",
        "",
        "## Cổng chất lượng khóa trước",
        "",
    ]
    for _, check in checks_frame.iterrows():
        report.append(
            f"- {check['check']}: **{check['status']}** "
            f"({check['value']:.3f}, ngưỡng {check['threshold']:.3f})."
        )
    (args.output_dir / "semantic_evaluation_report.md").write_text(
        "\n".join(report) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
