"""Build semantic-label-free temporal graph features for FinNexus KG V2.

Only entity relations, source relations, industry reference mappings and
strictly earlier news are used. Event type, sentiment, impact labels and future
market outcomes are deliberately excluded.
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
import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = ROOT / "data" / "dataset" / "finnexus_news_stock_2019_2022.csv"
DEFAULT_OUTPUT = (
    ROOT / "data" / "knowledge_graph" / "entity_temporal_features_v2.csv"
)
DEFAULT_REPORT = (
    ROOT
    / "data"
    / "quality"
    / "knowledge_graph"
    / "entity_temporal_features_v2_report.json"
)
GRAPH_VERSION = "FINNEXUS_ENTITY_TEMPORAL_GRAPH_FEATURES_V2_0"
FEATURE_COLUMNS = [
    "entity_stock_degree_centrality",
    "entity_stock_betweenness_centrality",
    "entity_stock_closeness_centrality",
    "entity_projection_nodes",
    "entity_projection_edges",
    "static_industry_peer_count",
    "historical_stock_news_count",
    "historical_stock_unique_source_count",
    "historical_stock_comention_peer_count",
    "historical_stock_comention_weight_sum",
    "recent_30d_stock_news_count",
    "recent_90d_stock_news_count",
    "recent_30d_stock_unique_source_count",
    "recent_90d_stock_unique_source_count",
    "recent_30d_industry_news_count",
    "recent_90d_industry_news_count",
    "recent_30d_industry_active_stock_count",
    "recent_90d_industry_active_stock_count",
    "recent_30d_stock_comention_peer_count",
    "recent_90d_stock_comention_peer_count",
    "recent_30d_stock_comention_weight_sum",
    "recent_90d_stock_comention_weight_sum",
    "recent_30d_same_source_stock_news_count",
    "days_since_previous_stock_news",
]
OUTPUT_COLUMNS = [
    "sample_id",
    "news_id",
    "symbol",
    "published_date",
    "split",
    "feature_cutoff_date",
    "history_rule",
    "history_relation_policy",
    *FEATURE_COLUMNS,
    "dataset_version",
    "graph_version",
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def atomic_write_csv(frame: pd.DataFrame, path: Path) -> None:
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


def static_industry_graph(dataset: pd.DataFrame) -> nx.Graph:
    graph = nx.Graph()
    reference = (
        dataset[["symbol", "industry"]]
        .drop_duplicates("symbol")
        .sort_values("symbol")
    )
    for _, row in reference.iterrows():
        graph.add_node(str(row["symbol"]).upper(), industry=str(row["industry"]))
    for _, group in reference.groupby("industry", sort=True):
        symbols = sorted(group["symbol"].astype(str).str.upper().unique())
        for position, source in enumerate(symbols):
            for target in symbols[position + 1 :]:
                graph.add_edge(
                    source,
                    target,
                    weight=1.0,
                    static_industry_edge=True,
                    historical_comention_count=0,
                )
    return graph


def add_historical_comentions(graph: nx.Graph, rows: pd.DataFrame) -> None:
    for _, group in rows.groupby("news_id", sort=True):
        symbols = sorted(group["symbol"].astype(str).str.upper().unique())
        for position, source in enumerate(symbols):
            for target in symbols[position + 1 :]:
                if not graph.has_edge(source, target):
                    graph.add_edge(
                        source,
                        target,
                        weight=1.0,
                        static_industry_edge=False,
                        historical_comention_count=1,
                    )
                else:
                    edge = graph[source][target]
                    edge["weight"] = float(edge.get("weight", 1.0)) + 1.0
                    edge["historical_comention_count"] = (
                        int(edge.get("historical_comention_count", 0)) + 1
                    )


def comention_stats(history: pd.DataFrame, symbol: str) -> tuple[int, int]:
    own_news = history.loc[history["symbol"].eq(symbol), "news_id"].unique()
    if len(own_news) == 0:
        return 0, 0
    peers = history.loc[
        history["news_id"].isin(own_news) & ~history["symbol"].eq(symbol),
        ["news_id", "symbol"],
    ].drop_duplicates()
    if peers.empty:
        return 0, 0
    counts = peers.groupby("symbol")["news_id"].nunique()
    return int(len(counts)), int(counts.sum())


def build_features(dataset: pd.DataFrame) -> pd.DataFrame:
    graph = static_industry_graph(dataset)
    history = dataset.iloc[0:0].copy()
    result: list[dict[str, Any]] = []

    industry_size = (
        dataset[["symbol", "industry"]]
        .drop_duplicates()
        .groupby("industry")["symbol"]
        .nunique()
        .to_dict()
    )
    for published_date, current in dataset.groupby("published_date", sort=True):
        cutoff = published_date - pd.Timedelta(days=1)
        recent_30 = history.loc[
            history["published_date"].ge(published_date - pd.Timedelta(days=30))
        ]
        recent_90 = history.loc[
            history["published_date"].ge(published_date - pd.Timedelta(days=90))
        ]
        degree = nx.degree_centrality(graph)
        betweenness = nx.betweenness_centrality(graph, normalized=True)
        closeness = nx.closeness_centrality(graph)

        for _, row in current.iterrows():
            symbol = str(row["symbol"]).upper()
            industry = str(row["industry"])
            source = str(row["source"])
            stock_history = history.loc[history["symbol"].eq(symbol)]
            stock_30 = recent_30.loc[recent_30["symbol"].eq(symbol)]
            stock_90 = recent_90.loc[recent_90["symbol"].eq(symbol)]
            industry_30 = recent_30.loc[recent_30["industry"].eq(industry)]
            industry_90 = recent_90.loc[recent_90["industry"].eq(industry)]
            historical_peers, historical_weight = comention_stats(
                history, symbol
            )
            peers_30, weight_30 = comention_stats(recent_30, symbol)
            peers_90, weight_90 = comention_stats(recent_90, symbol)
            previous_date = stock_history["published_date"].max()
            days_since_previous = (
                float((published_date - previous_date).days)
                if pd.notna(previous_date)
                else np.nan
            )
            result.append(
                {
                    "sample_id": row["sample_id"],
                    "news_id": row["news_id"],
                    "symbol": symbol,
                    "published_date": published_date.date().isoformat(),
                    "split": row["split"],
                    "feature_cutoff_date": cutoff.date().isoformat(),
                    "history_rule": "STRICTLY_BEFORE_PUBLICATION_DATE",
                    "history_relation_policy": (
                        "ENTITY_SOURCE_INDUSTRY_ONLY_NO_SEMANTIC_LABELS"
                    ),
                    "entity_stock_degree_centrality": degree.get(symbol, 0.0),
                    "entity_stock_betweenness_centrality": betweenness.get(
                        symbol, 0.0
                    ),
                    "entity_stock_closeness_centrality": closeness.get(
                        symbol, 0.0
                    ),
                    "entity_projection_nodes": graph.number_of_nodes(),
                    "entity_projection_edges": graph.number_of_edges(),
                    "static_industry_peer_count": max(
                        int(industry_size.get(industry, 1)) - 1, 0
                    ),
                    "historical_stock_news_count": stock_history[
                        "news_id"
                    ].nunique(),
                    "historical_stock_unique_source_count": stock_history[
                        "source"
                    ].nunique(),
                    "historical_stock_comention_peer_count": historical_peers,
                    "historical_stock_comention_weight_sum": historical_weight,
                    "recent_30d_stock_news_count": stock_30[
                        "news_id"
                    ].nunique(),
                    "recent_90d_stock_news_count": stock_90[
                        "news_id"
                    ].nunique(),
                    "recent_30d_stock_unique_source_count": stock_30[
                        "source"
                    ].nunique(),
                    "recent_90d_stock_unique_source_count": stock_90[
                        "source"
                    ].nunique(),
                    "recent_30d_industry_news_count": industry_30[
                        "news_id"
                    ].nunique(),
                    "recent_90d_industry_news_count": industry_90[
                        "news_id"
                    ].nunique(),
                    "recent_30d_industry_active_stock_count": industry_30[
                        "symbol"
                    ].nunique(),
                    "recent_90d_industry_active_stock_count": industry_90[
                        "symbol"
                    ].nunique(),
                    "recent_30d_stock_comention_peer_count": peers_30,
                    "recent_90d_stock_comention_peer_count": peers_90,
                    "recent_30d_stock_comention_weight_sum": weight_30,
                    "recent_90d_stock_comention_weight_sum": weight_90,
                    "recent_30d_same_source_stock_news_count": stock_30.loc[
                        stock_30["source"].eq(source), "news_id"
                    ].nunique(),
                    "days_since_previous_stock_news": days_since_previous,
                    "dataset_version": row["dataset_version"],
                    "graph_version": GRAPH_VERSION,
                }
            )

        add_historical_comentions(graph, current)
        history = pd.concat([history, current], ignore_index=True)

    return pd.DataFrame(result, columns=OUTPUT_COLUMNS).sort_values(
        ["published_date", "news_id", "symbol", "sample_id"]
    )


def validate(dataset: pd.DataFrame, features: pd.DataFrame) -> list[dict[str, Any]]:
    checks = [
        {
            "check": "row_count_matches_dataset",
            "observed": len(features),
            "expected": len(dataset),
            "status": "PASS" if len(features) == len(dataset) else "FAIL",
        },
        {
            "check": "unique_sample_id",
            "observed": features["sample_id"].nunique(),
            "expected": len(features),
            "status": "PASS"
            if not features["sample_id"].duplicated().any()
            else "FAIL",
        },
        {
            "check": "strict_temporal_cutoff",
            "observed": int(
                pd.to_datetime(features["feature_cutoff_date"]).lt(
                    pd.to_datetime(features["published_date"])
                ).sum()
            ),
            "expected": len(features),
            "status": "PASS"
            if pd.to_datetime(features["feature_cutoff_date"])
            .lt(pd.to_datetime(features["published_date"]))
            .all()
            else "FAIL",
        },
        {
            "check": "semantic_columns_absent",
            "observed": sorted(
                {
                    "event_type",
                    "sentiment",
                    "impact_level",
                    "affected_scope",
                }.intersection(features.columns)
            ),
            "expected": [],
            "status": "PASS"
            if not {
                "event_type",
                "sentiment",
                "impact_level",
                "affected_scope",
            }.intersection(features.columns)
            else "FAIL",
        },
        {
            "check": "future_outcome_columns_absent",
            "observed": sorted(
                [
                    column
                    for column in features.columns
                    if column.startswith(("return_", "primary_", "target_price"))
                ]
            ),
            "expected": [],
            "status": "PASS"
            if not [
                column
                for column in features.columns
                if column.startswith(("return_", "primary_", "target_price"))
            ]
            else "FAIL",
        },
    ]
    return checks


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    args = parser.parse_args()

    dataset = pd.read_csv(args.input, low_memory=False)
    required = {
        "dataset_version",
        "sample_id",
        "news_id",
        "symbol",
        "industry",
        "source",
        "published_date",
        "split",
        "entity_tier",
    }
    missing = sorted(required.difference(dataset.columns))
    if missing:
        raise ValueError(f"Dataset lacks columns: {missing}")
    if not dataset["entity_tier"].eq("HIGH_PRECISION").all():
        raise ValueError(
            "Entity V2 requires every retained relation to be HIGH_PRECISION"
        )
    dataset["published_date"] = pd.to_datetime(
        dataset["published_date"], errors="raise"
    )
    dataset["symbol"] = dataset["symbol"].astype(str).str.upper()
    dataset = dataset.sort_values(
        ["published_date", "news_id", "symbol", "sample_id"]
    ).reset_index(drop=True)

    features = build_features(dataset)
    checks = validate(dataset, features)
    if any(check["status"] == "FAIL" for check in checks):
        raise ValueError(f"Entity feature validation failed: {checks}")
    atomic_write_csv(features, args.output)
    report = {
        "graph_version": GRAPH_VERSION,
        "dataset_version": dataset["dataset_version"].iloc[0],
        "input": str(args.input.relative_to(ROOT)),
        "input_sha256": sha256(args.input),
        "output": str(args.output.relative_to(ROOT)),
        "output_sha256": sha256(args.output),
        "rows": len(features),
        "unique_news": features["news_id"].nunique(),
        "unique_symbols": features["symbol"].nunique(),
        "feature_columns": FEATURE_COLUMNS,
        "history_rule": "STRICTLY_BEFORE_PUBLICATION_DATE",
        "history_relation_policy": (
            "ENTITY_SOURCE_INDUSTRY_ONLY_NO_SEMANTIC_LABELS"
        ),
        "semantic_labels_used": False,
        "future_market_outcomes_used": False,
        "checks": checks,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
