"""Export CORE plus informative Semantic Quality V4 edges for Neo4j.

Fallback ``OTHER`` semantic relations and all future outcome relations are
excluded. The export is intended for exploration and demonstration, not Gold
semantic claims.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_LAYERED = ROOT / "data" / "knowledge_graph" / "layered"
DEFAULT_SEMANTIC = ROOT / "data" / "knowledge_graph" / "semantic_quality_v4"
DEFAULT_OUTPUT = DEFAULT_SEMANTIC / "neo4j_import"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bool_text(series: pd.Series) -> pd.Series:
    return series.astype(str).str.upper().eq("TRUE").map({True: "true", False: "false"})


def node_export(frame: pd.DataFrame) -> pd.DataFrame:
    output = pd.DataFrame()
    output["import_id:ID"] = frame["node_id"].astype(str)
    output["node_id"] = frame["node_id"].astype(str)
    output[":LABEL"] = frame["node_type"].astype(str)
    for column in (
        "name",
        "symbol",
        "valid_from",
        "valid_to",
        "source_news_id",
        "split",
        "attributes_json",
        "dataset_version",
        "graph_version",
        "kg_layer",
        "layered_release_version",
        "semantic_release_group",
        "semantic_quality_release",
    ):
        output[column] = frame[column] if column in frame else ""
    output["prediction_time_safe:boolean"] = bool_text(frame["prediction_time_safe"])
    return output


def relationship_export(frame: pd.DataFrame) -> pd.DataFrame:
    output = pd.DataFrame()
    output[":START_ID"] = frame["source_node_id"].astype(str)
    output[":END_ID"] = frame["target_node_id"].astype(str)
    output[":TYPE"] = frame["relation_type"].astype(str)
    output["edge_id"] = frame["edge_id"].astype(str)
    for column in (
        "event_time",
        "available_at",
        "split",
        "source_news_id",
        "source_url",
        "evidence_text",
        "confidence",
        "extraction_method",
        "review_status",
        "attributes_json",
        "quality_tier",
        "validation_basis",
        "allowed_use",
        "semantic_release_group",
        "semantic_quality_tier",
        "evidence_completeness_score",
        "manual_review_priority",
        "semantic_correctness_status",
        "semantic_quality_release",
    ):
        output[column] = frame[column] if column in frame else ""
    output["prediction_time_safe:boolean"] = bool_text(frame["prediction_time_safe"])
    return output


def write_support_files(output_dir: Path) -> None:
    constraints = [
        f"CREATE CONSTRAINT {label.lower()}_node_id IF NOT EXISTS FOR (n:{label}) REQUIRE n.node_id IS UNIQUE;"
        for label in (
            "News",
            "Stock",
            "Company",
            "Industry",
            "Source",
            "Time",
            "Exchange",
            "MarketIndex",
            "Event",
            "Sentiment",
        )
    ]
    (output_dir / "constraints.cypher").write_text("\n".join(constraints) + "\n", encoding="utf-8")
    queries = """// Core: tin gần nhất của VIC
MATCH (n:News)-[m:MENTIONS]->(s:Stock {symbol: 'VIC'})
RETURN n.valid_from AS date, n.name AS title, m.quality_tier AS entity_quality
ORDER BY date DESC LIMIT 10;

// Semantic V4: chỉ các candidate có thông tin, không có fallback OTHER
MATCH (n:News)-[ce:CONTAINS_EVENT]->(e:Event)-[a:AFFECTS]->(s:Stock)
MATCH (e)-[:HAS_SENTIMENT]->(sent:Sentiment)
WHERE s.symbol = 'VIC'
RETURN n.valid_from AS date, n.name AS title, e.name AS event,
       sent.name AS sentiment, ce.semantic_quality_tier AS quality_tier,
       ce.semantic_correctness_status AS validation_status
ORDER BY date DESC LIMIT 20;

// Kiểm tra không có fallback OTHER trong Semantic V4 import
MATCH ()-[r:CONTAINS_EVENT]->(e:Event)
WHERE e.name STARTS WITH 'OTHER:'
RETURN count(r) AS fallback_other_edges;
"""
    (output_dir / "example_queries.cypher").write_text(queries, encoding="utf-8")
    readme = """# FinNexus Neo4j import - Semantic Quality V4

Gói này gồm CORE và semantic informative candidates. Nhãn fallback `OTHER` và
toàn bộ outcome tương lai không được xuất.

```powershell
bin\\neo4j-admin database import full `
  --nodes=core_nodes_neo4j.csv `
  --nodes=semantic_v4_nodes_neo4j.csv `
  --relationships=core_relationships_neo4j.csv `
  --relationships=semantic_v4_relationships_neo4j.csv
```

Semantic V4 vẫn là experimental, không phải Gold. Khi hiển thị kết quả phải giữ
`semantic_quality_tier`, `semantic_correctness_status` và provenance.
"""
    (output_dir / "README.md").write_text(readme, encoding="utf-8")


def check_row(
    name: str, observed: Any, expected: Any, passed: bool
) -> dict[str, Any]:
    return {
        "check": name,
        "observed": observed,
        "expected": expected,
        "status": "PASS" if passed else "FAIL",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--layered_dir", type=Path, default=DEFAULT_LAYERED)
    parser.add_argument("--semantic_dir", type=Path, default=DEFAULT_SEMANTIC)
    parser.add_argument("--output_dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    core_nodes = pd.read_csv(args.layered_dir / "core_nodes.csv", keep_default_na=False, low_memory=False)
    core_edges = pd.read_csv(args.layered_dir / "core_edges.csv", keep_default_na=False, low_memory=False)
    semantic_nodes = pd.read_csv(args.semantic_dir / "semantic_nodes_v4.csv", keep_default_na=False, low_memory=False)
    semantic_edges = pd.read_csv(args.semantic_dir / "semantic_informative_edges.csv", keep_default_na=False, low_memory=False)

    core_ids = set(core_nodes["node_id"])
    semantic_endpoint_ids = set(semantic_edges["source_node_id"]) | set(semantic_edges["target_node_id"])
    needed_semantic_ids = semantic_endpoint_ids.difference(core_ids)
    semantic_nodes = semantic_nodes.loc[semantic_nodes["node_id"].isin(needed_semantic_ids)].copy()
    missing = needed_semantic_ids.difference(set(semantic_nodes["node_id"]))
    if missing:
        raise ValueError(f"Missing semantic endpoint nodes: {sorted(missing)[:10]}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    outputs = {
        "core_nodes": args.output_dir / "core_nodes_neo4j.csv",
        "semantic_nodes": args.output_dir / "semantic_v4_nodes_neo4j.csv",
        "core_relationships": args.output_dir / "core_relationships_neo4j.csv",
        "semantic_relationships": args.output_dir / "semantic_v4_relationships_neo4j.csv",
    }
    node_export(core_nodes).to_csv(outputs["core_nodes"], index=False, encoding="utf-8")
    node_export(semantic_nodes).to_csv(outputs["semantic_nodes"], index=False, encoding="utf-8")
    relationship_export(core_edges).to_csv(outputs["core_relationships"], index=False, encoding="utf-8")
    relationship_export(semantic_edges).to_csv(outputs["semantic_relationships"], index=False, encoding="utf-8")
    write_support_files(args.output_dir)

    all_ids = core_ids | set(semantic_nodes["node_id"])
    semantic_types = set(semantic_edges["relation_type"])
    checks = [
        check_row("semantic_endpoint_integrity", int((~semantic_edges["source_node_id"].isin(all_ids)).sum() + (~semantic_edges["target_node_id"].isin(all_ids)).sum()), 0, semantic_edges["source_node_id"].isin(all_ids).all() and semantic_edges["target_node_id"].isin(all_ids).all()),
        check_row("semantic_relation_allowlist", sorted(semantic_types), ["AFFECTS", "CONTAINS_EVENT", "HAS_SENTIMENT"], semantic_types == {"AFFECTS", "CONTAINS_EVENT", "HAS_SENTIMENT"}),
        check_row("other_fallback_excluded", int(semantic_edges["event_type"].eq("OTHER").sum()), 0, not semantic_edges["event_type"].eq("OTHER").any()),
        check_row("outcome_relations_excluded", sorted(semantic_types & {"HAS_REACTION", "OBSERVED_FOR", "BENCHMARKED_AGAINST"}), [], not (semantic_types & {"HAS_REACTION", "OBSERVED_FOR", "BENCHMARKED_AGAINST"})),
        check_row("semantic_status_preserved", sorted(semantic_edges["semantic_correctness_status"].unique()), ["NOT_INDEPENDENTLY_VALIDATED"], set(semantic_edges["semantic_correctness_status"]) == {"NOT_INDEPENDENTLY_VALIDATED"}),
    ]
    failed = sum(row["status"] == "FAIL" for row in checks)
    manifest = {
        "export_version": "FINNEXUS_NEO4J_SEMANTIC_V4_0",
        "status": "PASS" if failed == 0 else "FAIL",
        "default_profile": "CORE_PLUS_INFORMATIVE_SEMANTIC_V4",
        "semantic_gold_claim_allowed": False,
        "checks": checks,
        "files": {
            key: {
                "path": str(path.relative_to(ROOT)),
                "rows": len(pd.read_csv(path, low_memory=False)),
                "sha256": sha256(path),
            }
            for key, path in outputs.items()
        },
    }
    (args.output_dir / "neo4j_semantic_v4_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
