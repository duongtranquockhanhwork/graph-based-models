"""Validate separation and integrity of the FinNexus layered KG release."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import networkx as nx
import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_LAYERED = ROOT / "data" / "knowledge_graph" / "layered"
DEFAULT_QUALITY = (
    ROOT / "data" / "quality" / "knowledge_graph" / "layered"
)
CORE_RELATIONS = {
    "PUBLISHED_BY",
    "PUBLISHED_AT",
    "MENTIONS",
    "REPRESENTS",
    "BELONGS_TO",
    "LISTED_ON",
    "BENCHMARKED_BY",
}
EXPERIMENTAL_RELATIONS = {
    "CONTAINS_EVENT",
    "AFFECTS",
    "HAS_SENTIMENT",
}


def check(
    rows: list[dict[str, Any]],
    name: str,
    observed: Any,
    expected: Any,
    passed: bool,
) -> None:
    rows.append(
        {
            "check": name,
            "observed": observed,
            "expected": expected,
            "status": "PASS" if passed else "FAIL",
        }
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--layered_dir", type=Path, default=DEFAULT_LAYERED)
    parser.add_argument("--quality_dir", type=Path, default=DEFAULT_QUALITY)
    args = parser.parse_args()

    core_nodes = pd.read_csv(args.layered_dir / "core_nodes.csv", low_memory=False)
    core_edges = pd.read_csv(args.layered_dir / "core_edges.csv", low_memory=False)
    derived_edges = pd.read_csv(
        args.layered_dir / "derived_edges.csv", low_memory=False
    )
    semantic_nodes = pd.read_csv(
        args.layered_dir / "semantic_experimental_nodes.csv", low_memory=False
    )
    semantic_edges = pd.read_csv(
        args.layered_dir / "semantic_experimental_edges.csv", low_memory=False
    )
    manifest = json.loads(
        (args.layered_dir / "layer_manifest.json").read_text(encoding="utf-8")
    )
    graph = nx.read_graphml(args.layered_dir / "finnexus_core_graph.graphml")
    checks: list[dict[str, Any]] = []

    check(
        checks,
        "core_node_id_unique",
        core_nodes["node_id"].nunique(),
        len(core_nodes),
        not core_nodes["node_id"].duplicated().any(),
    )
    check(
        checks,
        "core_edge_id_unique",
        core_edges["edge_id"].nunique(),
        len(core_edges),
        not core_edges["edge_id"].duplicated().any(),
    )
    core_ids = set(core_nodes["node_id"])
    missing_core_endpoints = (
        ~core_edges["source_node_id"].isin(core_ids)
    ).sum() + (~core_edges["target_node_id"].isin(core_ids)).sum()
    check(
        checks,
        "core_referential_integrity",
        int(missing_core_endpoints),
        0,
        missing_core_endpoints == 0,
    )
    invalid_core_relations = sorted(
        set(core_edges["relation_type"]).difference(CORE_RELATIONS)
    )
    check(
        checks,
        "core_relation_allowlist",
        invalid_core_relations,
        [],
        not invalid_core_relations,
    )
    forbidden_core_nodes = sorted(
        set(core_nodes["node_type"]).intersection({"Event", "Sentiment", "MarketReaction"})
    )
    check(
        checks,
        "core_forbidden_node_types",
        forbidden_core_nodes,
        [],
        not forbidden_core_nodes,
    )
    unsafe_core = (~core_edges["prediction_time_safe"].astype(bool)).sum()
    check(
        checks,
        "core_prediction_time_safe",
        int(unsafe_core),
        0,
        unsafe_core == 0,
    )
    check(
        checks,
        "core_mentions_count",
        int(core_edges["relation_type"].eq("MENTIONS").sum()),
        1198,
        int(core_edges["relation_type"].eq("MENTIONS").sum()) == 1198,
    )
    mention_tiers = sorted(
        core_edges.loc[
            core_edges["relation_type"].eq("MENTIONS"), "quality_tier"
        ].unique()
    )
    check(
        checks,
        "mentions_quality_tier",
        mention_tiers,
        ["VALIDATED_HIGH_PRECISION_PIPELINE"],
        mention_tiers == ["VALIDATED_HIGH_PRECISION_PIPELINE"],
    )
    check(
        checks,
        "derived_relation_allowlist",
        sorted(derived_edges["relation_type"].unique()),
        ["RELATED_TO"],
        set(derived_edges["relation_type"]) == {"RELATED_TO"},
    )
    missing_derived_endpoints = (
        ~derived_edges["source_node_id"].isin(core_ids)
    ).sum() + (~derived_edges["target_node_id"].isin(core_ids)).sum()
    check(
        checks,
        "derived_referential_integrity",
        int(missing_derived_endpoints),
        0,
        missing_derived_endpoints == 0,
    )
    experimental_ids = core_ids | set(semantic_nodes["node_id"])
    missing_semantic_endpoints = (
        ~semantic_edges["source_node_id"].isin(experimental_ids)
    ).sum() + (~semantic_edges["target_node_id"].isin(experimental_ids)).sum()
    check(
        checks,
        "semantic_referential_integrity",
        int(missing_semantic_endpoints),
        0,
        missing_semantic_endpoints == 0,
    )
    check(
        checks,
        "semantic_relation_allowlist",
        sorted(semantic_edges["relation_type"].unique()),
        sorted(EXPERIMENTAL_RELATIONS),
        set(semantic_edges["relation_type"]) == EXPERIMENTAL_RELATIONS,
    )
    semantic_tiers = sorted(semantic_edges["quality_tier"].unique())
    check(
        checks,
        "semantic_experimental_tier",
        semantic_tiers,
        ["EXPERIMENTAL_WEAK_SEMANTIC"],
        semantic_tiers == ["EXPERIMENTAL_WEAK_SEMANTIC"],
    )
    layer_edge_ids = [
        set(core_edges["edge_id"]),
        set(derived_edges["edge_id"]),
        set(semantic_edges["edge_id"]),
    ]
    overlaps = sum(
        len(layer_edge_ids[left].intersection(layer_edge_ids[right]))
        for left in range(3)
        for right in range(left + 1, 3)
    )
    check(checks, "edge_layers_disjoint", overlaps, 0, overlaps == 0)
    check(
        checks,
        "graphml_node_count",
        graph.number_of_nodes(),
        len(core_nodes),
        graph.number_of_nodes() == len(core_nodes),
    )
    check(
        checks,
        "graphml_edge_count",
        graph.number_of_edges(),
        len(core_edges),
        graph.number_of_edges() == len(core_edges),
    )
    check(
        checks,
        "manifest_core_counts",
        [
            manifest["counts"]["core_nodes"],
            manifest["counts"]["core_edges"],
        ],
        [len(core_nodes), len(core_edges)],
        manifest["counts"]["core_nodes"] == len(core_nodes)
        and manifest["counts"]["core_edges"] == len(core_edges),
    )

    checks_frame = pd.DataFrame(checks)
    failed = int(checks_frame["status"].eq("FAIL").sum())
    summary = {
        "release_version": manifest["release_version"],
        "status": "PASS" if failed == 0 else "FAIL",
        "checks": len(checks_frame),
        "passed": int(checks_frame["status"].eq("PASS").sum()),
        "failed": failed,
        "core_nodes": len(core_nodes),
        "core_edges": len(core_edges),
        "derived_edges": len(derived_edges),
        "semantic_experimental_nodes": len(semantic_nodes),
        "semantic_experimental_edges": len(semantic_edges),
        "default_query_layer": "CORE",
        "semantic_layer_default_enabled": False,
    }
    args.quality_dir.mkdir(parents=True, exist_ok=True)
    checks_frame.to_csv(
        args.quality_dir / "layered_kg_checks.csv",
        index=False,
        encoding="utf-8-sig",
    )
    (args.quality_dir / "layered_kg_validation.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    report = [
        "# Kiểm định FinNexus Layered KG",
        "",
        f"**Kết luận: `{summary['status']}`.**",
        "",
        f"- Checks: {summary['passed']} PASS / {summary['failed']} FAIL.",
        f"- Core: {len(core_nodes):,} nodes / {len(core_edges):,} edges.",
        f"- Derived layer: {len(derived_edges):,} edges.",
        (
            f"- Experimental semantic layer: {len(semantic_nodes):,} nodes / "
            f"{len(semantic_edges):,} edges."
        ),
        "- Lớp mặc định cho truy vấn và demo: `CORE`.",
        "- Semantic experimental không được bật mặc định và không được mô tả là Gold.",
        "",
        "## Quy tắc sử dụng",
        "",
        "- Core dùng cho truy vấn nguồn, thời gian, mã, công ty, ngành, sàn và benchmark.",
        "- Derived layer chỉ dùng khám phá quan hệ cùng ngành.",
        "- Semantic experimental chỉ dùng nghiên cứu; phải hiển thị quality tier và provenance.",
        "- Outcome graph vẫn tách riêng và không được nhập vào prediction-time query/model.",
    ]
    (args.quality_dir / "layered_kg_validation.md").write_text(
        "\n".join(report) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
