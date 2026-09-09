"""Evaluate whether the layered FinNexus KG answers declared questions."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import networkx as nx
import pandas as pd
import yaml


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PROTOCOL = ROOT / "config" / "kg_competency_questions.yaml"
DEFAULT_LAYERED = ROOT / "data" / "knowledge_graph" / "layered"
DEFAULT_DATASET = (
    ROOT / "data" / "dataset" / "finnexus_news_stock_2019_2022.csv"
)
DEFAULT_OUTCOME_NODES = (
    ROOT / "data" / "knowledge_graph" / "outcome_nodes.csv"
)
DEFAULT_OUTCOME_EDGES = (
    ROOT / "data" / "knowledge_graph" / "outcome_edges.csv"
)
DEFAULT_OUTPUT = (
    ROOT / "data" / "quality" / "knowledge_graph" / "competency"
)


def ratio(numerator: int, denominator: int) -> float:
    return float(numerator / denominator) if denominator else 0.0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--protocol", type=Path, default=DEFAULT_PROTOCOL)
    parser.add_argument("--layered_dir", type=Path, default=DEFAULT_LAYERED)
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--outcome_nodes", type=Path, default=DEFAULT_OUTCOME_NODES)
    parser.add_argument("--outcome_edges", type=Path, default=DEFAULT_OUTCOME_EDGES)
    parser.add_argument("--output_dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    protocol = yaml.safe_load(args.protocol.read_text(encoding="utf-8"))
    question_by_id = {
        item["id"]: item for item in protocol["questions"]
    }
    nodes = pd.read_csv(args.layered_dir / "core_nodes.csv", low_memory=False)
    edges = pd.read_csv(args.layered_dir / "core_edges.csv", low_memory=False)
    derived = pd.read_csv(
        args.layered_dir / "derived_edges.csv", low_memory=False
    )
    semantic_nodes = pd.read_csv(
        args.layered_dir / "semantic_experimental_nodes.csv", low_memory=False
    )
    semantic_edges = pd.read_csv(
        args.layered_dir / "semantic_experimental_edges.csv", low_memory=False
    )
    dataset = pd.read_csv(args.dataset, low_memory=False)
    outcome_nodes = pd.read_csv(args.outcome_nodes, low_memory=False)
    outcome_edges = pd.read_csv(args.outcome_edges, low_memory=False)
    graphml = nx.read_graphml(args.layered_dir / "finnexus_core_graph.graphml")

    node_type = nodes.set_index("node_id")["node_type"].to_dict()
    node_name = nodes.set_index("node_id")["name"].to_dict()
    news_nodes = nodes.loc[nodes["node_type"].eq("News")].copy()
    stock_nodes = nodes.loc[nodes["node_type"].eq("Stock")].copy()
    news_id_by_node = news_nodes.set_index("node_id")["source_news_id"].to_dict()
    symbol_by_node = stock_nodes.set_index("node_id")["symbol"].to_dict()
    industry_by_stock = {
        str(row["node_id"]): json.loads(row["attributes_json"]).get(
            "industry", ""
        )
        for _, row in stock_nodes.iterrows()
    }
    metrics: dict[str, tuple[float, int, int, str]] = {}

    mentions = edges.loc[edges["relation_type"].eq("MENTIONS")].copy()
    graph_pairs = pd.DataFrame(
        {
            "news_id": mentions["source_node_id"].map(news_id_by_node),
            "symbol": mentions["target_node_id"].map(symbol_by_node),
        }
    ).drop_duplicates()
    canonical_pairs = dataset[["news_id", "symbol"]].drop_duplicates()
    pair_merge = canonical_pairs.merge(
        graph_pairs,
        on=["news_id", "symbol"],
        how="left",
        indicator=True,
    )
    matched_pairs = int(pair_merge["_merge"].eq("both").sum())
    metrics["CQ01"] = (
        ratio(matched_pairs, len(canonical_pairs)),
        matched_pairs,
        len(canonical_pairs),
        "Recall of canonical news-symbol pairs represented by CORE MENTIONS.",
    )

    publication_source = edges.loc[
        edges["relation_type"].eq("PUBLISHED_BY")
    ].groupby("source_node_id").size()
    publication_date = edges.loc[
        edges["relation_type"].eq("PUBLISHED_AT")
    ].groupby("source_node_id").size()
    exact_provenance = sum(
        publication_source.get(node_id, 0) == 1
        and publication_date.get(node_id, 0) == 1
        for node_id in news_nodes["node_id"]
    )
    metrics["CQ02"] = (
        ratio(exact_provenance, len(news_nodes)),
        int(exact_provenance),
        len(news_nodes),
        "News nodes with exactly one source and one publication date.",
    )

    reference_relations = [
        "REPRESENTS",
        "BELONGS_TO",
        "LISTED_ON",
        "BENCHMARKED_BY",
    ]
    complete_stocks = 0
    for stock_id in stock_nodes["node_id"]:
        if all(
            int(
                (
                    edges["source_node_id"].eq(stock_id)
                    & edges["relation_type"].eq(relation)
                ).sum()
            )
            == 1
            for relation in reference_relations
        ):
            complete_stocks += 1
    metrics["CQ03"] = (
        ratio(complete_stocks, len(stock_nodes)),
        complete_stocks,
        len(stock_nodes),
        "Stocks with exactly one company, industry, exchange and benchmark.",
    )

    canonical_news = dataset[["news_id", "source", "published_date"]].drop_duplicates(
        "news_id"
    )
    core_news_lookup = news_nodes.set_index("source_news_id")
    source_relation = edges.loc[
        edges["relation_type"].eq("PUBLISHED_BY")
    ].set_index("source_node_id")
    date_relation = edges.loc[
        edges["relation_type"].eq("PUBLISHED_AT")
    ].set_index("source_node_id")
    source_matches = 0
    date_matches = 0
    for _, row in canonical_news.iterrows():
        news_node_id = core_news_lookup.loc[row["news_id"], "node_id"]
        source_edge = source_relation.loc[news_node_id]
        date_edge = date_relation.loc[news_node_id]
        if isinstance(source_edge, pd.DataFrame):
            source_edge = source_edge.iloc[0]
        if isinstance(date_edge, pd.DataFrame):
            date_edge = date_edge.iloc[0]
        source_matches += (
            str(node_name[source_edge["target_node_id"]]) == str(row["source"])
        )
        date_matches += (
            str(node_name[date_edge["target_node_id"]])[:10]
            == str(row["published_date"])[:10]
        )
    metrics["CQ04"] = (
        ratio(source_matches, len(canonical_news)),
        int(source_matches),
        len(canonical_news),
        "Source node value matches canonical article source.",
    )
    metrics["CQ05"] = (
        ratio(date_matches, len(canonical_news)),
        int(date_matches),
        len(canonical_news),
        "Time node value matches canonical publication date.",
    )

    derived_consistent = sum(
        node_type.get(row["source_node_id"]) == "Stock"
        and node_type.get(row["target_node_id"]) == "Stock"
        and industry_by_stock.get(row["source_node_id"])
        == industry_by_stock.get(row["target_node_id"])
        for _, row in derived.iterrows()
    )
    metrics["CQ06"] = (
        ratio(derived_consistent, len(derived)),
        int(derived_consistent),
        len(derived),
        "RELATED_TO endpoints are stocks with the same reference industry.",
    )

    forbidden_node_types = {"Event", "Sentiment", "MarketReaction"}
    forbidden_relations = {
        "CONTAINS_EVENT",
        "AFFECTS",
        "HAS_SENTIMENT",
        "HAS_REACTION",
        "OBSERVED_FOR",
        "BENCHMARKED_AGAINST",
    }
    core_isolated = (
        not set(nodes["node_type"]).intersection(forbidden_node_types)
        and not set(edges["relation_type"]).intersection(forbidden_relations)
    )
    metrics["CQ07"] = (
        float(core_isolated),
        int(core_isolated),
        1,
        "CORE contains no semantic or future-outcome node/relation types.",
    )

    experimental_labeled = (
        semantic_edges["quality_tier"]
        .eq("EXPERIMENTAL_WEAK_SEMANTIC")
        .sum()
    )
    metrics["CQ08"] = (
        ratio(experimental_labeled, len(semantic_edges)),
        int(experimental_labeled),
        len(semantic_edges),
        "Experimental semantic edges carry an explicit non-Gold quality tier.",
    )

    outcome_separated = (
        len(outcome_nodes) > 0
        and len(outcome_edges) > 0
        and not set(outcome_nodes["node_id"]).intersection(nodes["node_id"])
        and not set(outcome_edges["edge_id"]).intersection(edges["edge_id"])
    )
    metrics["CQ09"] = (
        float(outcome_separated),
        int(outcome_separated),
        1,
        "Outcome tables are non-empty and ID-disjoint from CORE.",
    )

    queryable_symbols = graph_pairs["symbol"].dropna().nunique()
    canonical_symbols = dataset["symbol"].nunique()
    metrics["CQ10"] = (
        ratio(queryable_symbols, canonical_symbols),
        int(queryable_symbols),
        int(canonical_symbols),
        "Canonical symbols represented by at least one CORE MENTIONS relation.",
    )

    graph_dates = pd.to_datetime(news_nodes["valid_from"], errors="raise")
    data_dates = pd.to_datetime(dataset["published_date"], errors="raise")
    time_match = (
        graph_dates.min().date() == data_dates.min().date()
        and graph_dates.max().date() == data_dates.max().date()
    )
    metrics["CQ11"] = (
        float(time_match),
        int(time_match),
        1,
        (
            f"Graph range {graph_dates.min().date()}..{graph_dates.max().date()}; "
            f"dataset range {data_dates.min().date()}..{data_dates.max().date()}."
        ),
    )

    graphml_match = (
        graphml.number_of_nodes() == len(nodes)
        and graphml.number_of_edges() == len(edges)
    )
    metrics["CQ12"] = (
        float(graphml_match),
        int(graphml_match),
        1,
        "GraphML node/edge counts match CORE CSV tables.",
    )

    result_rows: list[dict[str, Any]] = []
    for question_id, (value, numerator, denominator, evidence) in metrics.items():
        specification = question_by_id[question_id]
        threshold = float(specification["threshold"])
        result_rows.append(
            {
                "question_id": question_id,
                "question": specification["question"],
                "metric": specification["metric"],
                "value": value,
                "threshold": threshold,
                "numerator": numerator,
                "denominator": denominator,
                "status": "PASS" if value >= threshold else "FAIL",
                "evidence": evidence,
            }
        )
    results = pd.DataFrame(result_rows).sort_values("question_id")
    critical = set(protocol["decision"]["critical_questions"])
    critical_failed = int(
        (
            results["question_id"].isin(critical)
            & results["status"].eq("FAIL")
        ).sum()
    )
    pass_rate = float(results["status"].eq("PASS").mean())
    ready = (
        pass_rate
        >= float(protocol["decision"]["functional_ready"]["minimum_pass_rate"])
        and critical_failed == 0
    )

    top_symbols = (
        graph_pairs.groupby("symbol")
        .size()
        .sort_values(ascending=False)
        .head(10)
        .rename("news_relations")
        .reset_index()
    )
    source_counts = (
        canonical_news.groupby("source")
        .size()
        .sort_values(ascending=False)
        .rename("unique_news")
        .reset_index()
    )
    examples = pd.concat(
        [
            top_symbols.assign(example_type="TOP_SYMBOLS").rename(
                columns={"symbol": "key", "news_relations": "value"}
            )[["example_type", "key", "value"]],
            source_counts.assign(example_type="SOURCE_COVERAGE").rename(
                columns={"source": "key", "unique_news": "value"}
            )[["example_type", "key", "value"]],
        ],
        ignore_index=True,
    )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    results.to_csv(
        args.output_dir / "competency_question_results.csv",
        index=False,
        encoding="utf-8-sig",
    )
    examples.to_csv(
        args.output_dir / "competency_query_examples.csv",
        index=False,
        encoding="utf-8-sig",
    )
    summary = {
        "protocol_version": protocol["protocol_version"],
        "layered_release": protocol["layered_release"],
        "status": "PASS" if ready else "FAIL",
        "questions": len(results),
        "passed": int(results["status"].eq("PASS").sum()),
        "failed": int(results["status"].eq("FAIL").sum()),
        "critical_failed": critical_failed,
        "pass_rate": pass_rate,
        "functional_query_ready": ready,
        "default_layer": "CORE",
    }
    (args.output_dir / "competency_question_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    report = [
        "# Kiểm thử competency questions của FinNexus KG",
        "",
        f"**Kết luận: `{summary['status']}`.**",
        "",
        (
            f"- {summary['passed']}/{summary['questions']} câu hỏi PASS; "
            f"{summary['critical_failed']} critical failure."
        ),
        "- Lớp được kiểm tra mặc định: `CORE`.",
        "",
        "| ID | Câu hỏi | Kết quả | Giá trị |",
        "|---|---|---:|---:|",
    ]
    for _, row in results.iterrows():
        report.append(
            f"| {row['question_id']} | {row['question']} | "
            f"**{row['status']}** | {row['value']:.3f} |"
        )
    report.extend(
        [
            "",
            "## Diễn giải",
            "",
            "- PASS chứng minh graph trả lời đúng các competency questions đã khai báo và khớp dataset canonical về cấu trúc/provenance.",
            "- PASS không chứng minh semantic experimental chính xác hay graph cải thiện dự báo giá.",
            "- Semantic và outcome vẫn phải được bật/tải riêng theo đúng layer policy.",
        ]
    )
    (args.output_dir / "KG_COMPETENCY_QUESTION_REPORT.md").write_text(
        "\n".join(report) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if not ready:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
