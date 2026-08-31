"""Evaluate completed independent review of the Semantic Quality V4 sample."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import pandas as pd
import yaml
from sklearn.metrics import accuracy_score, cohen_kappa_score, f1_score


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = ROOT / "config" / "kg_semantic_quality_v4.yaml"
YES_NO = {"YES", "NO"}

TASKS = {
    "event_type": {
        "auto": "auto_event_type",
        "correct": "event_type_correct",
        "corrected": "corrected_event_type",
        "labels": [
            "MARKET_TRADING",
            "MACRO_POLICY",
            "BUSINESS_RESULT",
            "CORPORATE_ACTION",
            "LEGAL_REGULATORY",
            "M_AND_A",
            "SECTOR_NEWS",
            "OTHER",
        ],
    },
    "sentiment": {
        "auto": "auto_sentiment",
        "correct": "sentiment_correct",
        "corrected": "corrected_sentiment",
        "labels": ["NEGATIVE", "NEUTRAL", "POSITIVE"],
    },
    "impact_level": {
        "auto": "auto_impact_level",
        "correct": "impact_level_correct",
        "corrected": "corrected_impact_level",
        "labels": ["LOW", "MODERATE", "HIGH"],
    },
    "affected_scope": {
        "auto": "auto_affected_scope",
        "correct": "affected_scope_correct",
        "corrected": "corrected_affected_scope",
        "labels": ["MARKET", "SECTOR", "STOCK_SPECIFIC"],
    },
}


def normalized(series: pd.Series) -> pd.Series:
    return series.astype(str).str.strip().str.upper()


def reviewer_truth(frame: pd.DataFrame, task: dict[str, Any]) -> pd.Series:
    correct = normalized(frame[task["correct"]])
    automatic = normalized(frame[task["auto"]])
    corrected = normalized(frame[task["corrected"]])
    return automatic.where(correct.eq("YES"), corrected)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--review_file", type=Path)
    args = parser.parse_args()

    config = yaml.safe_load(args.config.read_text(encoding="utf-8"))
    release_dir = ROOT / config["output"]["release_dir"]
    quality_dir = ROOT / config["output"]["quality_dir"]
    review_path = args.review_file or (release_dir / "semantic_review_sample.csv")
    review = pd.read_csv(review_path, keep_default_na=False, low_memory=False)

    invalid_rows: list[dict[str, Any]] = []
    completed_mask = normalized(review["review_status"]).eq("DONE")
    for index, row in review.iterrows():
        if not completed_mask.iloc[index]:
            continue
        for task_name, spec in TASKS.items():
            answer = str(row[spec["correct"]]).strip().upper()
            corrected = str(row[spec["corrected"]]).strip().upper()
            if answer not in YES_NO:
                invalid_rows.append(
                    {"row": index + 2, "sample_id": row["sample_id"], "task": task_name, "error": "correctness must be YES or NO"}
                )
            elif answer == "NO" and corrected not in set(spec["labels"]):
                invalid_rows.append(
                    {"row": index + 2, "sample_id": row["sample_id"], "task": task_name, "error": "corrected label missing or outside taxonomy"}
                )

    status = "PASS"
    if invalid_rows:
        status = "INVALID"
    elif not completed_mask.all():
        status = "INCOMPLETE"

    quality_dir.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(
        invalid_rows,
        columns=["row", "sample_id", "task", "error"],
    ).to_csv(quality_dir / "semantic_review_validation_errors.csv", index=False, encoding="utf-8-sig")

    metric_rows: list[dict[str, Any]] = []
    if status == "PASS":
        for task_name, spec in TASKS.items():
            y_true = reviewer_truth(review, spec)
            y_pred = normalized(review[spec["auto"]])
            labels = spec["labels"]
            metric_rows.extend(
                [
                    {"task": task_name, "metric": "accuracy", "value": accuracy_score(y_true, y_pred)},
                    {"task": task_name, "metric": "macro_f1", "value": f1_score(y_true, y_pred, labels=labels, average="macro", zero_division=0)},
                    {"task": task_name, "metric": "cohen_kappa", "value": cohen_kappa_score(y_true, y_pred, labels=labels)},
                ]
            )
            if task_name == "impact_level":
                metric_rows.append(
                    {
                        "task": task_name,
                        "metric": "quadratic_weighted_kappa",
                        "value": cohen_kappa_score(
                            y_true,
                            y_pred,
                            labels=["LOW", "MODERATE", "HIGH"],
                            weights="quadratic",
                        ),
                    }
                )
            for label in labels:
                truth_binary = y_true.eq(label)
                pred_binary = y_pred.eq(label)
                tp = int((truth_binary & pred_binary).sum())
                fp = int((~truth_binary & pred_binary).sum())
                fn = int((truth_binary & ~pred_binary).sum())
                precision = tp / (tp + fp) if tp + fp else 0.0
                recall = tp / (tp + fn) if tp + fn else 0.0
                f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
                metric_rows.append(
                    {
                        "task": task_name,
                        "metric": f"class_f1::{label}",
                        "value": f1,
                    }
                )

    metrics = pd.DataFrame(metric_rows, columns=["task", "metric", "value"])
    metrics.to_csv(quality_dir / "semantic_review_metrics.csv", index=False, encoding="utf-8-sig")
    gates = config["review_quality_gates"]
    gate_rows: list[dict[str, Any]] = []
    gate_specs = [
        ("event_type", "macro_f1", gates["event_type_macro_f1_min"]),
        ("sentiment", "macro_f1", gates["sentiment_macro_f1_min"]),
        ("affected_scope", "macro_f1", gates["affected_scope_macro_f1_min"]),
        ("impact_level", "quadratic_weighted_kappa", gates["impact_level_quadratic_kappa_min"]),
    ]
    if status == "PASS":
        for task, metric, threshold in gate_specs:
            value = float(metrics.loc[metrics["task"].eq(task) & metrics["metric"].eq(metric), "value"].iloc[0])
            gate_rows.append(
                {
                    "task": task,
                    "metric": metric,
                    "value": value,
                    "threshold": float(threshold),
                    "status": "PASS" if value >= float(threshold) else "FAIL",
                }
            )
    gates_frame = pd.DataFrame(gate_rows, columns=["task", "metric", "value", "threshold", "status"])
    gates_frame.to_csv(quality_dir / "semantic_review_quality_gates.csv", index=False, encoding="utf-8-sig")

    if status == "PASS" and not gates_frame["status"].eq("PASS").all():
        status = "QUALITY_GATE_FAIL"
    summary = {
        "protocol": "FINNEXUS_SEMANTIC_QUALITY_V4_INDEPENDENT_REVIEW_V1_0",
        "status": status,
        "review_file": str(review_path),
        "rows": len(review),
        "completed_rows": int(completed_mask.sum()),
        "pending_rows": int((~completed_mask).sum()),
        "invalid_entries": len(invalid_rows),
        "quality_gates_passed": int(gates_frame["status"].eq("PASS").sum()) if len(gates_frame) else 0,
        "quality_gates_failed": int(gates_frame["status"].eq("FAIL").sum()) if len(gates_frame) else 0,
        "semantic_gold_claim_allowed": status == "PASS",
    }
    (quality_dir / "semantic_review_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    report = [
        "# Kết quả kiểm định độc lập Semantic Quality V4",
        "",
        f"**Trạng thái: `{status}`.**",
        "",
        f"- Tổng số dòng: {len(review):,}.",
        f"- Đã hoàn tất: {int(completed_mask.sum()):,}.",
        f"- Còn chờ: {int((~completed_mask).sum()):,}.",
        f"- Ô không hợp lệ: {len(invalid_rows):,}.",
    ]
    if status == "INCOMPLETE":
        report.extend(
            [
                "",
                "Chưa tính metric vì mẫu review chưa hoàn tất. Điền `review_status=DONE`,",
                "các cột `*_correct=YES/NO`; nếu chọn NO phải điền nhãn sửa đúng taxonomy.",
            ]
        )
    elif len(gates_frame):
        report.extend(["", "## Quality gates", "", "| Task | Metric | Value | Threshold | Status |", "|---|---|---:|---:|---:|"])
        for _, row in gates_frame.iterrows():
            report.append(f"| {row['task']} | {row['metric']} | {row['value']:.4f} | {row['threshold']:.4f} | {row['status']} |")
    (quality_dir / "SEMANTIC_REVIEW_RESULT.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
