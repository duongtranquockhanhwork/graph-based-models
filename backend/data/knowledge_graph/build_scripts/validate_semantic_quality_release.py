"""Validate the FinNexus semantic quality V4 overlay."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import pandas as pd
import yaml


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = ROOT / "config" / "kg_semantic_quality_v4.yaml"


def add_check(
    checks: list[dict[str, Any]],
    category: str,
    name: str,
    observed: Any,
    expected: Any,
    passed: bool,
) -> None:
    checks.append(
        {
            "category": category,
            "check": name,
            "observed": json.dumps(observed, ensure_ascii=False)
            if isinstance(observed, (list, dict))
            else observed,
            "expected": json.dumps(expected, ensure_ascii=False)
            if isinstance(expected, (list, dict))
            else expected,
            "status": "PASS" if passed else "FAIL",
        }
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    args = parser.parse_args()

    config = yaml.safe_load(args.config.read_text(encoding="utf-8"))
    release_dir = ROOT / config["output"]["release_dir"]
    quality_dir = ROOT / config["output"]["quality_dir"]
    dataset = pd.read_csv(ROOT / config["input"]["dataset"], keep_default_na=False, low_memory=False)
    nodes = pd.read_csv(release_dir / "semantic_nodes_v4.csv", keep_default_na=False, low_memory=False)
    informative = pd.read_csv(release_dir / "semantic_informative_edges.csv", keep_default_na=False, low_memory=False)
    fallback = pd.read_csv(release_dir / "semantic_fallback_edges.csv", keep_default_na=False, low_memory=False)
    events = pd.read_csv(release_dir / "semantic_event_quality.csv", keep_default_na=False, low_memory=False)
    review = pd.read_csv(release_dir / "semantic_review_sample.csv", keep_default_na=False, low_memory=False)
    manifest = json.loads((release_dir / "semantic_quality_manifest.json").read_text(encoding="utf-8"))

    checks: list[dict[str, Any]] = []
    expected_relations = set(config["semantic_relations"])
    all_edges = pd.concat([informative, fallback], ignore_index=True)
    informative_ids = set(informative["edge_id"])
    fallback_ids = set(fallback["edge_id"])
    event_ids = set(events["sample_id"])

    add_check(checks, "IDENTITY", "event_quality_unique_sample_id", events["sample_id"].nunique(), len(events), not events["sample_id"].duplicated().any())
    add_check(checks, "COVERAGE", "event_quality_matches_dataset", len(events), len(dataset), len(events) == len(dataset))
    add_check(checks, "COVERAGE", "event_quality_sample_set_matches", len(event_ids.symmetric_difference(set(dataset["sample_id"]))), 0, event_ids == set(dataset["sample_id"]))
    add_check(checks, "IDENTITY", "semantic_edge_id_unique", all_edges["edge_id"].nunique(), len(all_edges), not all_edges["edge_id"].duplicated().any())
    add_check(checks, "LAYERING", "informative_fallback_disjoint", len(informative_ids & fallback_ids), 0, not (informative_ids & fallback_ids))
    add_check(checks, "COVERAGE", "three_edges_per_event", sorted(all_edges.groupby("semantic_sample_id").size().unique().tolist()), [3], all_edges.groupby("semantic_sample_id").size().eq(3).all())
    add_check(checks, "ONTOLOGY", "semantic_relation_allowlist", sorted(all_edges["relation_type"].unique()), sorted(expected_relations), set(all_edges["relation_type"]) == expected_relations)
    add_check(checks, "PROVENANCE", "source_news_id_complete", int(all_edges["source_news_id"].astype(str).str.strip().eq("").sum()), 0, all_edges["source_news_id"].astype(str).str.strip().ne("").all())
    add_check(checks, "PROVENANCE", "source_url_complete", int(all_edges["source_url"].astype(str).str.strip().eq("").sum()), 0, all_edges["source_url"].astype(str).str.strip().ne("").all())
    add_check(checks, "PROVENANCE", "evidence_complete", int(all_edges["evidence_text"].astype(str).str.strip().eq("").sum()), 0, all_edges["evidence_text"].astype(str).str.strip().ne("").all())
    add_check(checks, "SCIENTIFIC_STATUS", "semantic_correctness_not_overclaimed", sorted(all_edges["semantic_correctness_status"].unique()), ["NOT_INDEPENDENTLY_VALIDATED"], set(all_edges["semantic_correctness_status"]) == {"NOT_INDEPENDENTLY_VALIDATED"})
    add_check(checks, "SCIENTIFIC_STATUS", "allowed_use_declared", int(all_edges["allowed_use"].astype(str).str.strip().eq("").sum()), 0, all_edges["allowed_use"].astype(str).str.strip().ne("").all())
    add_check(checks, "FILTER", "informative_excludes_other", int(informative["event_type"].eq("OTHER").sum()), 0, not informative["event_type"].eq("OTHER").any())
    add_check(checks, "FILTER", "informative_high_confidence", sorted(informative["confidence"].unique()), ["HIGH"], set(informative["confidence"]) == {"HIGH"})
    add_check(checks, "FILTER", "fallback_contains_all_other", int(fallback["event_type"].eq("OTHER").sum()), int(dataset["event_type"].eq("OTHER").sum() * 3), int(fallback["event_type"].eq("OTHER").sum()) == int(dataset["event_type"].eq("OTHER").sum() * 3))
    add_check(checks, "FILTER", "fallback_disabled_by_default", int(fallback["default_semantic_query_enabled"].astype(str).str.upper().eq("TRUE").sum()), 0, not fallback["default_semantic_query_enabled"].astype(str).str.upper().eq("TRUE").any())
    add_check(checks, "FILTER", "informative_enabled_by_default", int(informative["default_semantic_query_enabled"].astype(str).str.upper().eq("TRUE").sum()), len(informative), informative["default_semantic_query_enabled"].astype(str).str.upper().eq("TRUE").all())
    add_check(checks, "TEMPORAL_SAFETY", "prediction_time_safe_only", sorted(all_edges["prediction_time_safe"].astype(str).str.upper().unique()), ["TRUE"], all_edges["prediction_time_safe"].astype(str).str.upper().eq("TRUE").all())
    add_check(checks, "TEMPORAL_SAFETY", "no_outcome_relations", sorted(set(all_edges["relation_type"]) & {"HAS_REACTION", "OBSERVED_FOR", "BENCHMARKED_AGAINST"}), [], not (set(all_edges["relation_type"]) & {"HAS_REACTION", "OBSERVED_FOR", "BENCHMARKED_AGAINST"}))
    add_check(checks, "NODES", "event_nodes_mapped", int(nodes.loc[nodes["node_type"].eq("Event"), "semantic_release_group"].eq("UNMAPPED").sum()), 0, not nodes.loc[nodes["node_type"].eq("Event"), "semantic_release_group"].eq("UNMAPPED").any())
    add_check(checks, "REVIEW", "review_sample_unique", review["sample_id"].nunique(), len(review), not review["sample_id"].duplicated().any())
    add_check(checks, "REVIEW", "review_status_pending", sorted(review["review_status"].unique()), ["PENDING"], set(review["review_status"]) == {"PENDING"})
    rare_types = set(config["review_sampling"]["rare_event_types"])
    observed_rare = set(review["auto_event_type"]) & rare_types
    expected_rare = set(dataset["event_type"]) & rare_types
    add_check(checks, "REVIEW", "rare_event_types_covered", sorted(observed_rare), sorted(expected_rare), observed_rare == expected_rare)
    add_check(checks, "MANIFEST", "manifest_counts_match", manifest["counts"], {
        "events_total": len(events),
        "informative_events": int(events["semantic_release_group"].eq("INFORMATIVE_CANDIDATE").sum()),
        "fallback_events": int(events["semantic_release_group"].eq("FALLBACK_QUARANTINE").sum()),
        "informative_edges": len(informative),
        "fallback_edges": len(fallback),
        "review_sample_rows": len(review),
    }, manifest["counts"] == {
        "events_total": len(events),
        "informative_events": int(events["semantic_release_group"].eq("INFORMATIVE_CANDIDATE").sum()),
        "fallback_events": int(events["semantic_release_group"].eq("FALLBACK_QUARANTINE").sum()),
        "informative_edges": len(informative),
        "fallback_edges": len(fallback),
        "review_sample_rows": len(review),
    })

    frame = pd.DataFrame(checks)
    failed = int(frame["status"].eq("FAIL").sum())
    summary = {
        "release_version": config["release_version"],
        "status": "PASS" if failed == 0 else "FAIL",
        "checks": len(frame),
        "passed": int(frame["status"].eq("PASS").sum()),
        "failed": failed,
        "events_total": len(events),
        "informative_events": int(events["semantic_release_group"].eq("INFORMATIVE_CANDIDATE").sum()),
        "fallback_events_quarantined": int(events["semantic_release_group"].eq("FALLBACK_QUARANTINE").sum()),
        "informative_edges": len(informative),
        "fallback_edges": len(fallback),
        "review_sample_rows": len(review),
        "semantic_gold_status": "NOT_GOLD_REQUIRES_INDEPENDENT_REVIEW",
        "default_semantic_profile": "INFORMATIVE_CANDIDATE_ONLY",
    }
    quality_dir.mkdir(parents=True, exist_ok=True)
    frame.to_csv(quality_dir / "semantic_quality_v4_checks.csv", index=False, encoding="utf-8-sig")
    (quality_dir / "semantic_quality_v4_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    report = [
        "# Kiểm định FinNexus Semantic Quality V4",
        "",
        f"**Kết luận kỹ thuật: `{summary['status']}`.**",
        "",
        f"- Kiểm tra: {summary['passed']}/{summary['checks']} PASS; {summary['failed']} FAIL.",
        f"- Sự kiện semantic có thông tin: {summary['informative_events']:,}.",
        f"- Sự kiện fallback đã cách ly: {summary['fallback_events_quarantined']:,}.",
        f"- Cạnh semantic được bật mặc định: {summary['informative_edges']:,}.",
        f"- Mẫu kiểm định thủ công: {summary['review_sample_rows']:,} dòng.",
        "",
        "## Ý nghĩa",
        "",
        "- V4 loại các nhãn OTHER khỏi profile semantic mặc định để giảm nhiễu.",
        "- Mọi cạnh còn lại vẫn được đánh dấu experimental và chưa phải Gold.",
        "- Core KG, outcome graph và dataset canonical không bị sửa.",
        "- Chỉ sau independent review mới được ước lượng Precision/F1 semantic V4.",
    ]
    (quality_dir / "SEMANTIC_QUALITY_V4_REPORT.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
