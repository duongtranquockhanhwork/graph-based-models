"""Create the current evidence-based readiness summary for FinNexus KG V4."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    technical = read_json(
        ROOT / "data" / "quality" / "knowledge_graph" / "kg_validation_report.json"
    )
    layered = read_json(
        ROOT
        / "data"
        / "quality"
        / "knowledge_graph"
        / "layered"
        / "layered_kg_validation.json"
    )
    competency = read_json(
        ROOT
        / "data"
        / "quality"
        / "knowledge_graph"
        / "competency"
        / "competency_question_summary.json"
    )
    semantic_v4 = read_json(
        ROOT
        / "data"
        / "quality"
        / "knowledge_graph"
        / "semantic_quality_v4"
        / "semantic_quality_v4_summary.json"
    )
    semantic_review = read_json(
        ROOT
        / "data"
        / "quality"
        / "knowledge_graph"
        / "semantic_quality_v4"
        / "semantic_review_summary.json"
    )
    scientific = read_json(
        ROOT / "outputs" / "kg_evaluation_v1" / "kg_readiness_summary.json"
    )
    neo4j = read_json(
        ROOT
        / "data"
        / "knowledge_graph"
        / "semantic_quality_v4"
        / "neo4j_import"
        / "neo4j_semantic_v4_manifest.json"
    )

    functional_ready = all(
        item["status"] == "PASS"
        for item in (technical, layered, competency, semantic_v4, neo4j)
    )
    semantic_validated = semantic_review["status"] == "PASS"
    predictive_value_proven = bool(scientific["predictive_graph_gate_pass"])
    overall = (
        "RESEARCH_KG_READY_SEMANTIC_CONFIRMATION_PENDING"
        if functional_ready and not semantic_validated
        else "REVIEW_REQUIRED"
    )
    summary = {
        "release": "FINNEXUS_KG_CURRENT_READINESS_V4_0",
        "overall_status": overall,
        "functional_query_ready": functional_ready,
        "neo4j_import_ready": neo4j["status"] == "PASS",
        "technical_graph_integrity": technical["status"],
        "layer_separation": layered["status"],
        "competency_questions": {
            "status": competency["status"],
            "passed": competency["passed"],
            "questions": competency["questions"],
        },
        "semantic_quality_v4": {
            "status": semantic_v4["status"],
            "informative_events": semantic_v4["informative_events"],
            "fallback_events_quarantined": semantic_v4[
                "fallback_events_quarantined"
            ],
            "informative_edges": semantic_v4["informative_edges"],
            "review_status": semantic_review["status"],
            "review_pending_rows": semantic_review["pending_rows"],
            "gold_claim_allowed": semantic_validated,
        },
        "predictive_graph_value_proven": predictive_value_proven,
        "allowed_now": [
            "CORE queries and provenance tracing",
            "Neo4j visualization and competency demonstrations",
            "Informative Semantic V4 exploratory queries with warning labels",
            "Leakage-safe graph ablation research",
        ],
        "not_allowed_yet": [
            "Calling Semantic V4 Gold",
            "Claiming causal news impact",
            "Claiming KG improves prediction",
            "Using KG output as trading advice",
        ],
        "next_gate": (
            "Complete independent review of 139 Semantic V4 rows and pass "
            "the preregistered semantic quality thresholds."
        ),
    }
    output_dir = ROOT / "data" / "quality" / "knowledge_graph"
    (output_dir / "kg_current_readiness_v4.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    report = [
        "# Trạng thái hiện tại của FinNexus KG V4",
        "",
        f"**Kết luận: `{overall}`.**",
        "",
        f"- Technical KG: {technical['passed']}/{technical['checks']} PASS.",
        f"- Layer separation: {layered['passed']}/{layered['checks']} PASS.",
        f"- Competency questions: {competency['passed']}/{competency['questions']} PASS.",
        f"- Semantic Quality V4: {semantic_v4['passed']}/{semantic_v4['checks']} PASS.",
        f"- Informative semantic events: {semantic_v4['informative_events']:,}.",
        f"- Fallback events quarantined: {semantic_v4['fallback_events_quarantined']:,}.",
        f"- Independent semantic review: {semantic_review['status']} ({semantic_review['pending_rows']} rows pending).",
        f"- Predictive graph incremental value proven: {predictive_value_proven}.",
        "",
        "## Được phép sử dụng",
        "",
    ]
    report.extend(f"- {item}." for item in summary["allowed_now"])
    report.extend(["", "## Chưa được phép kết luận", ""])
    report.extend(f"- {item}." for item in summary["not_allowed_yet"])
    report.extend(["", "## Cổng tiếp theo", "", summary["next_gate"]])
    (output_dir / "KG_CURRENT_READINESS_V4.md").write_text(
        "\n".join(report) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
