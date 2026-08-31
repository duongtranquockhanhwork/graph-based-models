"""Build a quality-tiered release of the FinNexus prediction-time KG.

The original graph is preserved. This release separates:

* core: source-traceable metadata, static reference relations and entity links;
* derived: relations inferred from trusted reference mappings;
* semantic_experimental: weak event/sentiment relations.

Future market outcomes remain in the existing, physically separate outcome
tables and are never copied into the prediction-time core.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any

import networkx as nx
import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_NODES = ROOT / "data" / "knowledge_graph" / "nodes.csv"
DEFAULT_EDGES = ROOT / "data" / "knowledge_graph" / "edges.csv"
DEFAULT_DATASET = (
    ROOT / "data" / "dataset" / "finnexus_news_stock_2019_2022.csv"
)
DEFAULT_SEMANTIC_SUMMARY = (
    ROOT
    / "outputs"
    / "kg_evaluation_v1"
    / "semantic_evaluation_summary.json"
)
DEFAULT_OUTPUT = ROOT / "data" / "knowledge_graph" / "layered"
RELEASE_VERSION = "FINNEXUS_LAYERED_KG_V3_0"

CORE_RELATIONS = {
    "PUBLISHED_BY",
    "PUBLISHED_AT",
    "MENTIONS",
    "REPRESENTS",
    "BELONGS_TO",
    "LISTED_ON",
    "BENCHMARKED_BY",
}
DERIVED_RELATIONS = {"RELATED_TO"}
EXPERIMENTAL_RELATIONS = {
    "CONTAINS_EVENT",
    "AFFECTS",
    "HAS_SENTIMENT",
}
CORE_NODE_TYPES = {
    "News",
    "Stock",
    "Company",
    "Industry",
    "Source",
    "Time",
    "Exchange",
    "MarketIndex",
}
EXPERIMENTAL_NODE_TYPES = {"Event", "Sentiment"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def atomic_csv(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, name = tempfile.mkstemp(
        prefix=f".{path.stem}_", suffix=".tmp.csv", dir=path.parent
    )
    os.close(descriptor)
    temporary = Path(name)
    try:
        frame.to_csv(temporary, index=False, encoding="utf-8-sig")
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def edge_quality(row: pd.Series) -> tuple[str, str, str]:
    relation = str(row["relation_type"])
    if relation in {"PUBLISHED_BY", "PUBLISHED_AT"}:
        return (
            "SOURCE_TRACEABLE",
            "Article source/date metadata retained with news provenance.",
            "QUERY_AND_MODEL_METADATA",
        )
    if relation == "MENTIONS":
        return (
            "VALIDATED_HIGH_PRECISION_PIPELINE",
            (
                "Entity pipeline HIGH_PRECISION stratum: precision 0.9189; "
                "Wilson 95% lower bound 0.8705. This is pipeline-level, not "
                "row-level human validation."
            ),
            "QUERY_ENTITY_LINK_AND_EXPLORATORY_MODELING",
        )
    if relation in {
        "REPRESENTS",
        "BELONGS_TO",
        "LISTED_ON",
        "BENCHMARKED_BY",
    }:
        return (
            "REFERENCE_WITH_STATIC_VALIDITY_ASSUMPTION",
            (
                "Local stock reference; historical effective dates are not "
                "available, so 2019-2022 validity is an explicit assumption."
            ),
            "QUERY_AND_REFERENCE_JOIN",
        )
    if relation in DERIVED_RELATIONS:
        return (
            "DERIVED_REFERENCE_NOT_INDEPENDENTLY_VALIDATED",
            "Derived from same-industry reference mapping.",
            "EXPLORATORY_QUERY_ONLY",
        )
    return (
        "EXPERIMENTAL_WEAK_SEMANTIC",
        (
            "WEAK_RULE_V3_ENTITY_TIERED edge; exact production semantic "
            "extractor has not been directly validated on frozen Gold."
        ),
        "EXPLORATORY_SEMANTIC_QUERY_ONLY",
    )


def annotate_edges(frame: pd.DataFrame, layer: str) -> pd.DataFrame:
    output = frame.copy()
    annotations = [edge_quality(row) for _, row in output.iterrows()]
    output["kg_layer"] = layer
    output["quality_tier"] = [item[0] for item in annotations]
    output["validation_basis"] = [item[1] for item in annotations]
    output["allowed_use"] = [item[2] for item in annotations]
    output["layered_release_version"] = RELEASE_VERSION
    return output


def annotate_nodes(frame: pd.DataFrame, layer: str) -> pd.DataFrame:
    output = frame.copy()
    output["kg_layer"] = layer
    output["layered_release_version"] = RELEASE_VERSION
    return output


def to_graphml(nodes: pd.DataFrame, edges: pd.DataFrame, path: Path) -> None:
    graph = nx.MultiDiGraph(release_version=RELEASE_VERSION, layer="core")
    for _, row in nodes.iterrows():
        attributes = {
            key: "" if pd.isna(value) else str(value)
            for key, value in row.items()
            if key != "node_id"
        }
        graph.add_node(str(row["node_id"]), **attributes)
    for _, row in edges.iterrows():
        attributes = {
            key: "" if pd.isna(value) else str(value)
            for key, value in row.items()
            if key not in {"source_node_id", "target_node_id"}
        }
        graph.add_edge(
            str(row["source_node_id"]),
            str(row["target_node_id"]),
            key=str(row["edge_id"]),
            **attributes,
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    nx.write_graphml(graph, path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--nodes", type=Path, default=DEFAULT_NODES)
    parser.add_argument("--edges", type=Path, default=DEFAULT_EDGES)
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument(
        "--semantic_summary", type=Path, default=DEFAULT_SEMANTIC_SUMMARY
    )
    parser.add_argument("--output_dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    nodes = pd.read_csv(args.nodes, low_memory=False)
    edges = pd.read_csv(args.edges, low_memory=False)
    dataset = pd.read_csv(args.dataset, low_memory=False)
    semantic_summary: dict[str, Any] = json.loads(
        args.semantic_summary.read_text(encoding="utf-8")
    )
    if (
        semantic_summary["high_precision_tier_entity_precision"] < 0.90
        or semantic_summary[
            "high_precision_tier_entity_precision_wilson_95"
        ][0]
        < 0.85
    ):
        raise ValueError("Entity pipeline does not pass the locked core gate")
    if not dataset["entity_tier"].eq("HIGH_PRECISION").all():
        raise ValueError("Canonical dataset contains a non-HIGH_PRECISION relation")

    core_edges = annotate_edges(
        edges.loc[edges["relation_type"].isin(CORE_RELATIONS)].copy(),
        "CORE",
    )
    derived_edges = annotate_edges(
        edges.loc[edges["relation_type"].isin(DERIVED_RELATIONS)].copy(),
        "DERIVED",
    )
    semantic_edges = annotate_edges(
        edges.loc[edges["relation_type"].isin(EXPERIMENTAL_RELATIONS)].copy(),
        "SEMANTIC_EXPERIMENTAL",
    )
    accounted = set(core_edges["edge_id"]) | set(derived_edges["edge_id"]) | set(
        semantic_edges["edge_id"]
    )
    if accounted != set(edges["edge_id"]):
        missing = sorted(set(edges["edge_id"]).difference(accounted))
        raise ValueError(f"Unassigned prediction edges: {missing[:10]}")

    core_nodes = annotate_nodes(
        nodes.loc[nodes["node_type"].isin(CORE_NODE_TYPES)].copy(), "CORE"
    )
    semantic_nodes = annotate_nodes(
        nodes.loc[nodes["node_type"].isin(EXPERIMENTAL_NODE_TYPES)].copy(),
        "SEMANTIC_EXPERIMENTAL",
    )
    if len(core_nodes) + len(semantic_nodes) != len(nodes):
        raise ValueError("Some prediction nodes were not assigned to a layer")

    outputs = {
        "core_nodes": args.output_dir / "core_nodes.csv",
        "core_edges": args.output_dir / "core_edges.csv",
        "derived_edges": args.output_dir / "derived_edges.csv",
        "semantic_nodes": args.output_dir / "semantic_experimental_nodes.csv",
        "semantic_edges": args.output_dir / "semantic_experimental_edges.csv",
        "core_graphml": args.output_dir / "finnexus_core_graph.graphml",
    }
    for key, frame in (
        ("core_nodes", core_nodes),
        ("core_edges", core_edges),
        ("derived_edges", derived_edges),
        ("semantic_nodes", semantic_nodes),
        ("semantic_edges", semantic_edges),
    ):
        atomic_csv(frame, outputs[key])
    to_graphml(core_nodes, core_edges, outputs["core_graphml"])

    manifest = {
        "release_version": RELEASE_VERSION,
        "dataset_version": dataset["dataset_version"].iloc[0],
        "source_graph_version": nodes["graph_version"].iloc[0],
        "input_hashes": {
            "nodes": sha256(args.nodes),
            "edges": sha256(args.edges),
            "dataset": sha256(args.dataset),
            "semantic_evaluation_summary": sha256(args.semantic_summary),
        },
        "layer_policy": {
            "core": sorted(CORE_RELATIONS),
            "derived": sorted(DERIVED_RELATIONS),
            "semantic_experimental": sorted(EXPERIMENTAL_RELATIONS),
            "future_outcome_layer": (
                "Retained separately at data/knowledge_graph/outcome_*.csv"
            ),
        },
        "counts": {
            "core_nodes": len(core_nodes),
            "core_edges": len(core_edges),
            "derived_edges": len(derived_edges),
            "semantic_experimental_nodes": len(semantic_nodes),
            "semantic_experimental_edges": len(semantic_edges),
        },
        "entity_validation_basis": {
            "precision": semantic_summary[
                "high_precision_tier_entity_precision"
            ],
            "wilson_95": semantic_summary[
                "high_precision_tier_entity_precision_wilson_95"
            ],
            "scope": "PIPELINE_LEVEL_NOT_ROW_LEVEL_GOLD",
        },
        "scientific_limits": [
            "Core MENTIONS edges inherit pipeline-level precision, not manual validation of every edge.",
            "Static stock reference relations lack historical effective dates.",
            "Derived RELATED_TO edges are exploratory and excluded from core.",
            "Event and sentiment edges remain experimental and are excluded from core.",
            "Market outcomes are observational and remain physically separate.",
        ],
        "outputs": {
            key: {
                "path": str(path.relative_to(ROOT)),
                "sha256": sha256(path),
            }
            for key, path in outputs.items()
        },
    }
    (args.output_dir / "layer_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
