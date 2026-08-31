"""Query the FinNexus layered KG by stock symbol.

The safe CORE layer is used by default. Semantic V4 informative candidates can
be requested explicitly; fallback ``OTHER`` edges remain quarantined.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_LAYERED = ROOT / "data" / "knowledge_graph" / "layered"
DEFAULT_SEMANTIC_V4 = (
    ROOT / "data" / "knowledge_graph" / "semantic_quality_v4"
)


def attributes(value: Any) -> dict[str, Any]:
    if value is None or pd.isna(value) or not str(value).strip():
        return {}
    try:
        payload = json.loads(str(value))
        return payload if isinstance(payload, dict) else {}
    except json.JSONDecodeError:
        return {}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument(
        "--include_semantic_experimental", action="store_true"
    )
    parser.add_argument(
        "--semantic_profile",
        choices=("none", "v3_all", "v4_informative"),
        default="none",
        help=(
            "Semantic overlay to join. v4_informative excludes quarantined "
            "OTHER fallback relations."
        ),
    )
    parser.add_argument("--output", type=Path)
    parser.add_argument("--layered_dir", type=Path, default=DEFAULT_LAYERED)
    parser.add_argument(
        "--semantic_v4_dir", type=Path, default=DEFAULT_SEMANTIC_V4
    )
    args = parser.parse_args()
    semantic_profile = args.semantic_profile
    if args.include_semantic_experimental and semantic_profile == "none":
        semantic_profile = "v3_all"

    nodes = pd.read_csv(args.layered_dir / "core_nodes.csv", low_memory=False)
    edges = pd.read_csv(args.layered_dir / "core_edges.csv", low_memory=False)
    symbol = args.symbol.strip().upper()
    stock_match = nodes.loc[
        nodes["node_type"].eq("Stock")
        & nodes["symbol"].astype(str).str.upper().eq(symbol)
    ]
    if stock_match.empty:
        available = ", ".join(
            sorted(nodes.loc[nodes["node_type"].eq("Stock"), "symbol"].astype(str))
        )
        raise ValueError(f"Unknown symbol {symbol}. Available: {available}")
    stock_id = str(stock_match["node_id"].iloc[0])

    mentions = edges.loc[
        edges["relation_type"].eq("MENTIONS")
        & edges["target_node_id"].eq(stock_id)
    ].copy()
    news_ids = mentions["source_node_id"].astype(str)
    news = (
        nodes.loc[nodes["node_id"].isin(news_ids)]
        .set_index("node_id")
        .copy()
    )
    source_edges = edges.loc[
        edges["relation_type"].eq("PUBLISHED_BY")
        & edges["source_node_id"].isin(news_ids)
    ]
    source_names = nodes.set_index("node_id")["name"].to_dict()
    source_by_news = {
        str(row["source_node_id"]): source_names.get(
            str(row["target_node_id"]), ""
        )
        for _, row in source_edges.iterrows()
    }

    rows: list[dict[str, Any]] = []
    mention_by_news = mentions.set_index("source_node_id")
    for news_id, row in news.iterrows():
        metadata = attributes(row.get("attributes_json"))
        mention = mention_by_news.loc[news_id]
        if isinstance(mention, pd.DataFrame):
            mention = mention.iloc[0]
        rows.append(
            {
                "symbol": symbol,
                "news_id": row.get("source_news_id", ""),
                "published_date": row.get("valid_from", ""),
                "source": source_by_news.get(str(news_id), ""),
                "title": row.get("name", ""),
                "url": metadata.get("url", ""),
                "category": metadata.get("category", ""),
                "entity_quality_tier": mention.get("quality_tier", ""),
                "entity_validation_basis": mention.get(
                    "validation_basis", ""
                ),
                "semantic_layer": "NOT_REQUESTED",
                "event_type_experimental": "",
                "sentiment_experimental": "",
                "semantic_quality_tier": "",
                "semantic_review_priority": "",
                "semantic_correctness_status": "",
            }
        )
    result = pd.DataFrame(rows)

    if semantic_profile != "none" and not result.empty:
        if semantic_profile == "v4_informative":
            semantic_nodes_path = args.semantic_v4_dir / "semantic_nodes_v4.csv"
            semantic_edges_path = (
                args.semantic_v4_dir / "semantic_informative_edges.csv"
            )
        else:
            semantic_nodes_path = (
                args.layered_dir / "semantic_experimental_nodes.csv"
            )
            semantic_edges_path = (
                args.layered_dir / "semantic_experimental_edges.csv"
            )
        semantic_nodes = pd.read_csv(semantic_nodes_path, low_memory=False)
        semantic_edges = pd.read_csv(semantic_edges_path, low_memory=False)
        all_node_names = {
            **nodes.set_index("node_id")["name"].to_dict(),
            **semantic_nodes.set_index("node_id")["name"].to_dict(),
        }
        news_node_by_source_id = nodes.loc[
            nodes["node_type"].eq("News")
        ].set_index("source_news_id")["node_id"].to_dict()
        events_by_news_node = (
            semantic_edges.loc[
                semantic_edges["relation_type"].eq("CONTAINS_EVENT")
            ]
            .groupby("source_node_id")["target_node_id"]
            .apply(list)
            .to_dict()
        )
        affects = semantic_edges.loc[
            semantic_edges["relation_type"].eq("AFFECTS")
            & semantic_edges["target_node_id"].eq(stock_id)
        ]
        stock_event_ids = set(affects["source_node_id"])
        sentiment_edges = semantic_edges.loc[
            semantic_edges["relation_type"].eq("HAS_SENTIMENT")
        ].set_index("source_node_id")
        event_node_rows = semantic_nodes.loc[
            semantic_nodes["node_type"].eq("Event")
        ].set_index("node_id")
        for index, row in result.iterrows():
            news_node = news_node_by_source_id.get(row["news_id"])
            event_ids = [
                event_id
                for event_id in events_by_news_node.get(news_node, [])
                if event_id in stock_event_ids
            ]
            if not event_ids:
                result.at[index, "semantic_layer"] = (
                    "EXPERIMENTAL_NO_MATCH"
                )
                continue
            event_id = event_ids[0]
            event_attributes = attributes(
                event_node_rows.loc[event_id, "attributes_json"]
            )
            sentiment = ""
            if event_id in sentiment_edges.index:
                sentiment_row = sentiment_edges.loc[event_id]
                if isinstance(sentiment_row, pd.DataFrame):
                    sentiment_row = sentiment_row.iloc[0]
                sentiment = all_node_names.get(
                    sentiment_row["target_node_id"], ""
                )
            result.at[index, "semantic_layer"] = (
                "SEMANTIC_V4_INFORMATIVE_NOT_GOLD"
                if semantic_profile == "v4_informative"
                else "SEMANTIC_EXPERIMENTAL_NOT_GOLD"
            )
            result.at[index, "event_type_experimental"] = (
                event_attributes.get("event_type", "")
            )
            result.at[index, "sentiment_experimental"] = sentiment
            if semantic_profile == "v4_informative":
                event_edges = semantic_edges.loc[
                    semantic_edges["semantic_sample_id"].eq(
                        event_attributes.get("sample_id", "")
                    )
                ]
                if not event_edges.empty:
                    evidence_row = event_edges.iloc[0]
                    result.at[index, "semantic_quality_tier"] = evidence_row.get(
                        "semantic_quality_tier", ""
                    )
                    result.at[index, "semantic_review_priority"] = evidence_row.get(
                        "manual_review_priority", ""
                    )
                    result.at[index, "semantic_correctness_status"] = evidence_row.get(
                        "semantic_correctness_status", ""
                    )

    result = result.sort_values(
        ["published_date", "news_id"], ascending=[False, True]
    ).head(max(args.limit, 0))
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        result.to_csv(args.output, index=False, encoding="utf-8-sig")
        print(f"Wrote {len(result)} rows to {args.output}")
    else:
        print(result.to_json(orient="records", force_ascii=False, indent=2))


if __name__ == "__main__":
    main()
