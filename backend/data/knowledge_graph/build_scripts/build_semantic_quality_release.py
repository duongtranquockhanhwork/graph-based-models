"""Build a quality-controlled semantic overlay for the FinNexus KG.

This release does not modify the canonical dataset or the existing V3 layered
graph. It separates informative weak-rule semantic candidates from fallback
``OTHER`` labels, adds auditable evidence metadata, and creates a deterministic
human-review sample. No automatic relation is promoted to Gold.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any

import pandas as pd
import yaml


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = ROOT / "config" / "kg_semantic_quality_v4.yaml"


def clean(value: Any) -> str:
    if value is None or pd.isna(value):
        return ""
    return " ".join(str(value).replace("\xa0", " ").split())


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


def atomic_text(text: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, name = tempfile.mkstemp(
        prefix=f".{path.stem}_", suffix=".tmp", dir=path.parent
    )
    os.close(descriptor)
    temporary = Path(name)
    try:
        temporary.write_text(text, encoding="utf-8")
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def parse_attributes(value: Any) -> dict[str, Any]:
    raw = clean(value)
    if not raw:
        return {}
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError("attributes_json must contain an object")
    return parsed


def evidence_score(row: pd.Series) -> int:
    """Score evidence completeness, not semantic correctness probability."""

    score = 0
    score += 25 if clean(row.get("entity_tier")) == "HIGH_PRECISION" else 0
    score += 20 if clean(row.get("relation_directness")).startswith("TITLE_") else 0
    score += 15 if clean(row.get("reason")) else 0
    score += 10 if clean(row.get("symbol_evidence")) else 0
    score += 10 if clean(row.get("url")) else 0
    score += 10 if clean(row.get("event_type")) != "OTHER" else 0
    score += 10 if clean(row.get("confidence")) == "HIGH" else 0
    return score


def review_priority(row: pd.Series, rare_types: set[str]) -> str:
    event_type = clean(row["event_type"])
    if event_type in rare_types:
        return "CRITICAL"
    if event_type != "OTHER":
        return "HIGH"
    return "MEDIUM"


def deterministic_review_sample(
    events: pd.DataFrame,
    *,
    seed: int,
    per_event_type: int,
    fallback_rows: int,
    preview_chars: int,
) -> pd.DataFrame:
    selected: list[pd.DataFrame] = []
    informative = events.loc[events["semantic_release_group"].eq("INFORMATIVE_CANDIDATE")]
    for event_type, group in informative.groupby("event_type", sort=True):
        selected.append(
            group.sample(
                n=min(per_event_type, len(group)),
                random_state=seed + sum(ord(char) for char in str(event_type)),
            )
        )
    fallback = events.loc[events["semantic_release_group"].eq("FALLBACK_QUARANTINE")]
    selected.append(
        fallback.sample(n=min(fallback_rows, len(fallback)), random_state=seed + 997)
    )
    sample = pd.concat(selected, ignore_index=True).drop_duplicates("sample_id")
    priority_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2}
    sample["_priority_order"] = sample["manual_review_priority"].map(priority_order)
    sample = sample.sort_values(
        ["_priority_order", "event_type", "published_date", "news_id", "symbol"]
    ).drop(columns="_priority_order")
    output = sample[
        [
            "sample_id",
            "news_id",
            "symbol",
            "company",
            "published_date",
            "source",
            "url",
            "title",
            "content",
            "event_type",
            "event_type_detail",
            "sentiment",
            "impact_level",
            "affected_scope",
            "confidence",
            "reason",
            "symbol_evidence",
            "relation_directness",
            "semantic_release_group",
            "semantic_quality_tier",
            "evidence_completeness_score",
            "manual_review_priority",
        ]
    ].copy()
    output["content"] = output["content"].map(lambda value: clean(value)[:preview_chars])
    output = output.rename(
        columns={
            "content": "content_preview",
            "event_type": "auto_event_type",
            "event_type_detail": "auto_event_type_detail",
            "sentiment": "auto_sentiment",
            "impact_level": "auto_impact_level",
            "affected_scope": "auto_affected_scope",
            "confidence": "auto_confidence",
        }
    )
    output.insert(0, "review_status", "PENDING")
    for column in (
        "event_type_correct",
        "sentiment_correct",
        "impact_level_correct",
        "affected_scope_correct",
        "corrected_event_type",
        "corrected_sentiment",
        "corrected_impact_level",
        "corrected_affected_scope",
        "review_notes",
        "reviewer_id",
    ):
        output[column] = ""
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    args = parser.parse_args()

    config = yaml.safe_load(args.config.read_text(encoding="utf-8"))
    input_cfg = config["input"]
    dataset_path = ROOT / input_cfg["dataset"]
    nodes_path = ROOT / input_cfg["nodes"]
    edges_path = ROOT / input_cfg["edges"]
    entity_evaluation_path = ROOT / input_cfg["entity_evaluation"]
    release_dir = ROOT / config["output"]["release_dir"]
    quality_dir = ROOT / config["output"]["quality_dir"]

    dataset = pd.read_csv(dataset_path, keep_default_na=False, low_memory=False)
    nodes = pd.read_csv(nodes_path, keep_default_na=False, low_memory=False)
    edges = pd.read_csv(edges_path, keep_default_na=False, low_memory=False)
    entity_evaluation = json.loads(entity_evaluation_path.read_text(encoding="utf-8"))

    required_dataset = {
        "sample_id",
        "news_id",
        "symbol",
        "company",
        "published_date",
        "source",
        "url",
        "title",
        "content",
        "event_type",
        "event_type_detail",
        "sentiment",
        "impact_level",
        "affected_scope",
        "confidence",
        "reason",
        "symbol_evidence",
        "relation_directness",
        "entity_tier",
        "labeling_method",
    }
    missing = sorted(required_dataset.difference(dataset.columns))
    if missing:
        raise ValueError(f"Dataset missing semantic columns: {missing}")
    if dataset["sample_id"].duplicated().any():
        raise ValueError("sample_id must be unique")

    semantic_relations = set(config["semantic_relations"])
    semantic_edges = edges.loc[edges["relation_type"].isin(semantic_relations)].copy()
    if len(semantic_edges) != len(dataset) * len(semantic_relations):
        raise ValueError("Expected exactly three semantic edges per dataset relation")
    semantic_edges["semantic_sample_id"] = semantic_edges["attributes_json"].map(
        lambda value: clean(parse_attributes(value).get("sample_id"))
    )
    if semantic_edges["semantic_sample_id"].eq("").any():
        raise ValueError("Semantic edge without sample_id")

    excluded = set(config["informative_candidate_rule"]["excluded_event_types"])
    required_confidence = config["informative_candidate_rule"]["required_label_confidence"]
    required_entity_tier = config["informative_candidate_rule"]["required_entity_tier"]
    informative_mask = (
        ~dataset["event_type"].isin(excluded)
        & dataset["confidence"].eq(required_confidence)
        & dataset["entity_tier"].eq(required_entity_tier)
        & dataset["url"].astype(str).str.strip().ne("")
        & dataset["reason"].astype(str).str.strip().ne("")
    )
    dataset = dataset.copy()
    dataset["semantic_release_group"] = informative_mask.map(
        {True: "INFORMATIVE_CANDIDATE", False: "FALLBACK_QUARANTINE"}
    )
    dataset["semantic_quality_tier"] = dataset["semantic_release_group"].map(
        {
            "INFORMATIVE_CANDIDATE": "EXPERIMENTAL_INFORMATIVE_UNVALIDATED",
            "FALLBACK_QUARANTINE": "FALLBACK_NO_EVENT_DETECTED",
        }
    )
    dataset["evidence_completeness_score"] = dataset.apply(evidence_score, axis=1)
    rare_types = set(config["review_sampling"]["rare_event_types"])
    dataset["manual_review_priority"] = dataset.apply(
        review_priority, axis=1, rare_types=rare_types
    )
    dataset["semantic_correctness_status"] = "NOT_INDEPENDENTLY_VALIDATED"
    dataset["default_semantic_query_enabled"] = dataset[
        "semantic_release_group"
    ].eq("INFORMATIVE_CANDIDATE")

    event_metadata = dataset.set_index("sample_id")[
        [
            "event_type",
            "event_type_detail",
            "sentiment",
            "impact_level",
            "affected_scope",
            "semantic_release_group",
            "semantic_quality_tier",
            "evidence_completeness_score",
            "manual_review_priority",
            "semantic_correctness_status",
            "default_semantic_query_enabled",
        ]
    ]
    semantic_edges = semantic_edges.join(
        event_metadata, on="semantic_sample_id", validate="many_to_one"
    )
    semantic_edges["semantic_quality_release"] = config["release_version"]
    semantic_edges["validation_basis"] = (
        "Entity link pipeline passed precision gate; exact semantic labels remain unvalidated."
    )
    semantic_edges["allowed_use"] = semantic_edges["semantic_release_group"].map(
        {
            "INFORMATIVE_CANDIDATE": "EXPLORATORY_QUERY_AND_ABLATION_ONLY",
            "FALLBACK_QUARANTINE": "LINEAGE_AND_ERROR_ANALYSIS_ONLY",
        }
    )
    informative_edges = semantic_edges.loc[
        semantic_edges["semantic_release_group"].eq("INFORMATIVE_CANDIDATE")
    ].copy()
    fallback_edges = semantic_edges.loc[
        semantic_edges["semantic_release_group"].eq("FALLBACK_QUARANTINE")
    ].copy()

    event_group = dataset.set_index("sample_id")["semantic_release_group"].to_dict()
    semantic_nodes = nodes.loc[nodes["node_type"].isin({"Event", "Sentiment"})].copy()
    semantic_nodes["semantic_sample_id"] = semantic_nodes.apply(
        lambda row: clean(parse_attributes(row["attributes_json"]).get("sample_id"))
        if row["node_type"] == "Event"
        else "",
        axis=1,
    )
    semantic_nodes["semantic_release_group"] = semantic_nodes.apply(
        lambda row: event_group.get(row["semantic_sample_id"], "UNMAPPED")
        if row["node_type"] == "Event"
        else "SHARED_LABEL_DICTIONARY",
        axis=1,
    )
    semantic_nodes["semantic_quality_release"] = config["release_version"]

    event_quality_columns = [
        "sample_id",
        "news_id",
        "symbol",
        "company",
        "published_date",
        "source",
        "url",
        "title",
        "event_type",
        "event_type_detail",
        "sentiment",
        "impact_level",
        "affected_scope",
        "confidence",
        "labeling_method",
        "reason",
        "symbol_evidence",
        "relation_directness",
        "entity_tier",
        "semantic_release_group",
        "semantic_quality_tier",
        "evidence_completeness_score",
        "manual_review_priority",
        "semantic_correctness_status",
        "default_semantic_query_enabled",
    ]
    event_quality = dataset[event_quality_columns].copy()
    review_cfg = config["review_sampling"]
    review_sample = deterministic_review_sample(
        dataset,
        seed=int(review_cfg["random_seed"]),
        per_event_type=int(review_cfg["informative_per_event_type"]),
        fallback_rows=int(review_cfg["fallback_rows"]),
        preview_chars=int(review_cfg["content_preview_characters"]),
    )

    outputs = {
        "semantic_nodes": release_dir / "semantic_nodes_v4.csv",
        "informative_edges": release_dir / "semantic_informative_edges.csv",
        "fallback_edges": release_dir / "semantic_fallback_edges.csv",
        "event_quality": release_dir / "semantic_event_quality.csv",
        "review_sample": release_dir / "semantic_review_sample.csv",
    }
    for key, frame in (
        ("semantic_nodes", semantic_nodes),
        ("informative_edges", informative_edges),
        ("fallback_edges", fallback_edges),
        ("event_quality", event_quality),
        ("review_sample", review_sample),
    ):
        atomic_csv(frame, outputs[key])

    manifest = {
        "release_version": config["release_version"],
        "source_graph_version": config["source_graph_version"],
        "dataset_version": clean(dataset["dataset_version"].iloc[0]),
        "status": "BUILT_NOT_GOLD",
        "input_hashes": {
            "config": sha256(args.config),
            "dataset": sha256(dataset_path),
            "nodes": sha256(nodes_path),
            "edges": sha256(edges_path),
            "entity_evaluation": sha256(entity_evaluation_path),
        },
        "entity_validation_basis": {
            "high_precision_tier_precision": entity_evaluation[
                "high_precision_tier_entity_precision"
            ],
            "wilson_95": entity_evaluation[
                "high_precision_tier_entity_precision_wilson_95"
            ],
            "scope": "PIPELINE_LEVEL_ENTITY_LINK_PRECISION_ONLY",
        },
        "counts": {
            "events_total": int(len(dataset)),
            "informative_events": int(informative_mask.sum()),
            "fallback_events": int((~informative_mask).sum()),
            "informative_edges": int(len(informative_edges)),
            "fallback_edges": int(len(fallback_edges)),
            "review_sample_rows": int(len(review_sample)),
        },
        "policy": {
            "default_semantic_query_group": "INFORMATIVE_CANDIDATE",
            "fallback_default_enabled": False,
            "semantic_gold_claim_allowed": False,
            "predictive_superiority_claim_allowed": False,
            "outcomes_included": False,
        },
        "outputs": {
            key: {"path": str(path.relative_to(ROOT)), "sha256": sha256(path)}
            for key, path in outputs.items()
        },
    }
    manifest_path = release_dir / "semantic_quality_manifest.json"
    atomic_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", manifest_path)

    build_report = [
        "# FinNexus Semantic Quality Release V4",
        "",
        f"- Release: `{manifest['release_version']}`.",
        f"- Total semantic events: {manifest['counts']['events_total']:,}.",
        f"- Informative experimental candidates: {manifest['counts']['informative_events']:,}.",
        f"- Fallback events quarantined: {manifest['counts']['fallback_events']:,}.",
        f"- Human-review sample: {manifest['counts']['review_sample_rows']:,} rows.",
        "",
        "## Scientific policy",
        "",
        "- Core KG is unchanged.",
        "- Informative semantic relations remain experimental and are not Gold.",
        "- OTHER fallback relations are excluded from default semantic queries and models.",
        "- Evidence completeness is not an accuracy probability.",
        "- Future market outcomes are not included in this release.",
    ]
    atomic_text("\n".join(build_report) + "\n", quality_dir / "SEMANTIC_QUALITY_V4_BUILD_REPORT.md")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
