"""Validate FinNexus KG integrity, ontology conformance and temporal safety."""

from __future__ import annotations

import argparse
import json
import os
import tempfile
from pathlib import Path
from typing import Any

import pandas as pd
import yaml


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ONTOLOGY = ROOT / "config" / "kg_ontology.yaml"
DEFAULT_KG_DIR = ROOT / "data" / "knowledge_graph"
DEFAULT_QUALITY = ROOT / "data" / "quality" / "knowledge_graph"

NODE_REQUIRED = {
    "node_id",
    "node_type",
    "prediction_time_safe",
    "dataset_version",
    "graph_version",
}
EDGE_REQUIRED = {
    "edge_id",
    "source_node_id",
    "relation_type",
    "target_node_id",
    "event_time",
    "available_at",
    "prediction_time_safe",
    "source_news_id",
    "dataset_version",
    "graph_version",
}
FEATURE_REQUIRED = {
    "sample_id",
    "news_id",
    "symbol",
    "published_date",
    "feature_cutoff_date",
    "history_rule",
}
FORBIDDEN_FEATURE_TOKENS = (
    "target",
    "reaction_direction",
    "abnormal_return",
    "future_",
    "price_t_plus",
    "impact_score",
    "impact_band",
    "ground_truth",
)


def atomic_write_text(content: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.stem}_", suffix=".tmp", dir=path.parent
    )
    os.close(descriptor)
    temporary = Path(temporary_name)
    try:
        temporary.write_text(content, encoding="utf-8")
        temporary.replace(path)
    finally:
        if temporary.exists():
            temporary.unlink()


def load_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(path)
    return pd.read_csv(path, dtype=str, keep_default_na=False, low_memory=False)


def check(
    checks: list[dict[str, Any]],
    category: str,
    name: str,
    observed: Any,
    expected: Any,
    passed: bool,
    severity: str = "FAIL",
) -> None:
    checks.append(
        {
            "category": category,
            "check": name,
            "observed": observed,
            "expected": expected,
            "status": "PASS" if passed else severity,
        }
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ontology", default=str(DEFAULT_ONTOLOGY))
    parser.add_argument("--kg-dir", default=str(DEFAULT_KG_DIR))
    parser.add_argument("--quality-dir", default=str(DEFAULT_QUALITY))
    args = parser.parse_args()

    ontology = yaml.safe_load(Path(args.ontology).read_text(encoding="utf-8"))
    kg_dir = Path(args.kg_dir)
    quality_dir = Path(args.quality_dir)
    nodes = load_csv(kg_dir / "nodes.csv")
    edges = load_csv(kg_dir / "edges.csv")
    outcome_nodes = load_csv(kg_dir / "outcome_nodes.csv")
    outcome_edges = load_csv(kg_dir / "outcome_edges.csv")
    features = load_csv(kg_dir / "temporal_graph_features.csv")
    checks: list[dict[str, Any]] = []

    for label, frame, required in (
        ("nodes", nodes, NODE_REQUIRED),
        ("edges", edges, EDGE_REQUIRED),
        ("outcome_nodes", outcome_nodes, NODE_REQUIRED),
        ("outcome_edges", outcome_edges, EDGE_REQUIRED),
        ("temporal_graph_features", features, FEATURE_REQUIRED),
    ):
        missing = sorted(required - set(frame.columns))
        check(
            checks,
            "SCHEMA",
            f"{label}_required_columns",
            missing,
            [],
            not missing,
        )

    allowed_nodes = set(ontology["node_types"])
    relation_contract = ontology["relation_types"]
    allowed_relations = set(relation_contract)
    all_nodes = pd.concat([nodes, outcome_nodes], ignore_index=True)
    all_edges = pd.concat([edges, outcome_edges], ignore_index=True)
    node_types = dict(zip(all_nodes["node_id"], all_nodes["node_type"]))

    duplicate_node_ids = int(all_nodes["node_id"].duplicated().sum())
    duplicate_edge_ids = int(all_edges["edge_id"].duplicated().sum())
    check(
        checks,
        "IDENTITY",
        "duplicate_node_id",
        duplicate_node_ids,
        0,
        duplicate_node_ids == 0,
    )
    check(
        checks,
        "IDENTITY",
        "duplicate_edge_id",
        duplicate_edge_ids,
        0,
        duplicate_edge_ids == 0,
    )

    invalid_node_types = sorted(set(all_nodes["node_type"]) - allowed_nodes)
    invalid_relations = sorted(set(all_edges["relation_type"]) - allowed_relations)
    check(
        checks,
        "ONTOLOGY",
        "invalid_node_types",
        invalid_node_types,
        [],
        not invalid_node_types,
    )
    check(
        checks,
        "ONTOLOGY",
        "invalid_relation_types",
        invalid_relations,
        [],
        not invalid_relations,
    )

    node_ids = set(all_nodes["node_id"])
    missing_sources = sorted(set(all_edges["source_node_id"]) - node_ids)
    missing_targets = sorted(set(all_edges["target_node_id"]) - node_ids)
    check(
        checks,
        "REFERENTIAL_INTEGRITY",
        "missing_source_nodes",
        len(missing_sources),
        0,
        not missing_sources,
    )
    check(
        checks,
        "REFERENTIAL_INTEGRITY",
        "missing_target_nodes",
        len(missing_targets),
        0,
        not missing_targets,
    )

    type_violations = []
    for row in all_edges.itertuples(index=False):
        contract = relation_contract.get(row.relation_type)
        if not contract:
            continue
        source_type = node_types.get(row.source_node_id)
        target_type = node_types.get(row.target_node_id)
        if (
            source_type != contract["source"]
            or target_type != contract["target"]
        ):
            type_violations.append(row.edge_id)
    check(
        checks,
        "ONTOLOGY",
        "relation_endpoint_type_violations",
        len(type_violations),
        0,
        not type_violations,
    )

    safe_flag_violations = int(
        edges["prediction_time_safe"].str.upper().ne("TRUE").sum()
    )
    outcome_flag_violations = int(
        outcome_edges["prediction_time_safe"].str.upper().ne("FALSE").sum()
        + outcome_nodes["prediction_time_safe"].str.upper().ne("FALSE").sum()
    )
    check(
        checks,
        "TEMPORAL_SAFETY",
        "prediction_edge_safety_flags",
        safe_flag_violations,
        0,
        safe_flag_violations == 0,
    )
    check(
        checks,
        "TEMPORAL_SAFETY",
        "outcome_safety_flags",
        outcome_flag_violations,
        0,
        outcome_flag_violations == 0,
    )

    safe_relation_contract_violations = [
        relation
        for relation in edges["relation_type"].unique()
        if not relation_contract[relation]["prediction_time_safe"]
    ]
    outcome_relation_contract_violations = [
        relation
        for relation in outcome_edges["relation_type"].unique()
        if relation_contract[relation]["prediction_time_safe"]
    ]
    check(
        checks,
        "TEMPORAL_SAFETY",
        "future_relations_in_prediction_graph",
        safe_relation_contract_violations,
        [],
        not safe_relation_contract_violations,
    )
    check(
        checks,
        "TEMPORAL_SAFETY",
        "safe_relations_in_outcome_graph",
        outcome_relation_contract_violations,
        [],
        not outcome_relation_contract_violations,
    )

    event_time = pd.to_datetime(outcome_edges["event_time"], errors="coerce")
    available_at = pd.to_datetime(outcome_edges["available_at"], errors="coerce")
    invalid_availability = int(
        (event_time.isna() | available_at.isna() | available_at.lt(event_time)).sum()
    )
    check(
        checks,
        "TEMPORAL_SAFETY",
        "outcome_available_before_event",
        invalid_availability,
        0,
        invalid_availability == 0,
    )

    published = pd.to_datetime(features["published_date"], errors="coerce")
    cutoff = pd.to_datetime(features["feature_cutoff_date"], errors="coerce")
    invalid_cutoff = int(
        (published.isna() | cutoff.isna() | cutoff.ge(published)).sum()
    )
    check(
        checks,
        "TEMPORAL_SAFETY",
        "graph_feature_cutoff_not_strictly_prior",
        invalid_cutoff,
        0,
        invalid_cutoff == 0,
    )
    invalid_history_rule = int(
        features["history_rule"]
        .ne("STRICTLY_BEFORE_PUBLICATION_DATE")
        .sum()
    )
    check(
        checks,
        "TEMPORAL_SAFETY",
        "invalid_history_rule",
        invalid_history_rule,
        0,
        invalid_history_rule == 0,
    )

    forbidden_feature_columns = sorted(
        column
        for column in features.columns
        if any(token in column.casefold() for token in FORBIDDEN_FEATURE_TOKENS)
    )
    check(
        checks,
        "LEAKAGE",
        "forbidden_future_feature_columns",
        forbidden_feature_columns,
        [],
        not forbidden_feature_columns,
    )

    duplicate_feature_samples = int(features["sample_id"].duplicated().sum())
    check(
        checks,
        "IDENTITY",
        "duplicate_temporal_feature_sample",
        duplicate_feature_samples,
        0,
        duplicate_feature_samples == 0,
    )

    semantic_edges = edges[
        edges["relation_type"].isin(
            ["MENTIONS", "CONTAINS_EVENT", "AFFECTS", "HAS_SENTIMENT"]
        )
    ]
    mislabeled_review = int(
        semantic_edges["review_status"].ne("AUTO_EXTRACTED_UNREVIEWED").sum()
    )
    check(
        checks,
        "PROVENANCE",
        "weak_semantic_edges_marked_unreviewed",
        mislabeled_review,
        0,
        mislabeled_review == 0,
    )
    missing_provenance = int(
        semantic_edges[
            ["source_news_id", "source_url", "extraction_method"]
        ]
        .eq("")
        .any(axis=1)
        .sum()
    )
    check(
        checks,
        "PROVENANCE",
        "semantic_edges_missing_provenance",
        missing_provenance,
        0,
        missing_provenance == 0,
    )

    frame = pd.DataFrame(checks)
    failed = int(frame["status"].eq("FAIL").sum())
    warnings = int(frame["status"].eq("WARNING").sum())
    report = {
        "ontology_version": ontology["ontology_version"],
        "graph_version": ontology["graph_version"],
        "status": "PASS" if failed == 0 else "FAIL",
        "checks": len(frame),
        "passed": int(frame["status"].eq("PASS").sum()),
        "warnings": warnings,
        "failed": failed,
        "prediction_nodes": len(nodes),
        "prediction_edges": len(edges),
        "outcome_nodes": len(outcome_nodes),
        "outcome_edges": len(outcome_edges),
        "temporal_graph_feature_rows": len(features),
        "check_details": checks,
    }

    quality_dir.mkdir(parents=True, exist_ok=True)
    atomic_write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        quality_dir / "kg_validation_report.json",
    )
    frame.to_csv(
        quality_dir / "kg_validation_checks.csv",
        index=False,
        encoding="utf-8-sig",
    )
    markdown = [
        "# Kiểm định FinNexus temporal Knowledge Graph",
        "",
        f"**Kết luận:** `{report['status']}`",
        "",
        (
            f"- Checks: {report['passed']} PASS / "
            f"{warnings} WARNING / {failed} FAIL."
        ),
        f"- Prediction-time nodes: {len(nodes):,}.",
        f"- Prediction-time edges: {len(edges):,}.",
        f"- Outcome nodes: {len(outcome_nodes):,}.",
        f"- Outcome edges: {len(outcome_edges):,}.",
        f"- Temporal graph feature rows: {len(features):,}.",
        "",
        "## Kiểm soát khoa học",
        "",
        "- Future market outcomes are physically separated from prediction edges.",
        "- Graph features use history strictly before each publication date.",
        "- Weak semantic edges are marked unreviewed and retain source provenance.",
        "- Static reference mappings retain an explicit historical-validity assumption.",
    ]
    atomic_write_text(
        "\n".join(markdown) + "\n",
        quality_dir / "kg_validation_report.md",
    )

    print(json.dumps(report, ensure_ascii=False, indent=2))
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
