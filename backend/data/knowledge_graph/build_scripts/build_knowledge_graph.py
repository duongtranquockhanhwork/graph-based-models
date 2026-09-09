"""Build the leakage-safe FinNexus temporal knowledge graph.

The builder deliberately separates two layers:

* ``nodes.csv`` and ``edges.csv`` contain only information available when an
  article is published (plus documented static reference mappings).
* ``outcome_nodes.csv`` and ``outcome_edges.csv`` contain future market
  reactions. They are targets/evaluation data, never input edges for the same
  event.

Temporal graph features use news strictly earlier than ``published_date``.
Same-day news is excluded because publication timestamps are unavailable.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any, Iterable

import networkx as nx
import numpy as np
import pandas as pd
import yaml


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = ROOT / "data" / "dataset" / "finnexus_news_stock_2019_2022.csv"
DEFAULT_STOCKS = ROOT / "data" / "reference" / "stocks_master.csv"
DEFAULT_ONTOLOGY = ROOT / "config" / "kg_ontology.yaml"
DEFAULT_OUTPUT = ROOT / "data" / "knowledge_graph"
DEFAULT_QUALITY = ROOT / "data" / "quality" / "knowledge_graph"

NODE_COLUMNS = [
    "node_id",
    "node_type",
    "name",
    "symbol",
    "valid_from",
    "valid_to",
    "source_news_id",
    "split",
    "prediction_time_safe",
    "attributes_json",
    "dataset_version",
    "graph_version",
]

EDGE_COLUMNS = [
    "edge_id",
    "source_node_id",
    "relation_type",
    "target_node_id",
    "event_time",
    "available_at",
    "valid_from",
    "valid_to",
    "split",
    "prediction_time_safe",
    "source_news_id",
    "source_url",
    "evidence_text",
    "confidence",
    "extraction_method",
    "review_status",
    "attributes_json",
    "dataset_version",
    "graph_version",
]

FEATURE_COLUMNS = [
    "sample_id",
    "news_id",
    "symbol",
    "published_date",
    "split",
    "feature_cutoff_date",
    "history_rule",
    "stock_degree_centrality",
    "stock_betweenness_centrality",
    "stock_closeness_centrality",
    "stock_projection_nodes",
    "stock_projection_edges",
    "historical_stock_news_count",
    "historical_stock_event_count",
    "historical_stock_positive_count",
    "historical_stock_negative_count",
    "historical_stock_neutral_count",
    "recent_30d_stock_news_count",
    "recent_30d_stock_positive_count",
    "recent_30d_stock_negative_count",
    "recent_30d_industry_news_count",
    "recent_30d_industry_sentiment_mean",
    "recent_30d_same_event_type_count",
    "recent_30d_industry_stocks_same_event_type",
    "dataset_version",
    "graph_version",
]

REQUIRED_COLUMNS = {
    "dataset_version",
    "sample_id",
    "news_id",
    "symbol",
    "company",
    "industry",
    "exchange",
    "title",
    "published_date",
    "source",
    "url",
    "split",
    "event_type",
    "event_type_detail",
    "sentiment",
    "impact_level",
    "affected_scope",
    "confidence",
    "labeling_method",
    "symbol_evidence",
    "relation_directness",
    "index_symbol",
}

HORIZONS = (1, 3, 5)
SENTIMENT_VALUE = {"NEGATIVE": -1.0, "NEUTRAL": 0.0, "POSITIVE": 1.0}


def text(value: Any) -> str:
    if value is None or pd.isna(value):
        return ""
    return " ".join(str(value).replace("\xa0", " ").split())


def boolean_text(value: bool) -> str:
    return "TRUE" if value else "FALSE"


def stable_hash(*parts: Any, length: int = 20) -> str:
    payload = "|".join(text(part) for part in parts)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:length]


def entity_id(prefix: str, value: Any) -> str:
    cleaned = text(value)
    return f"{prefix}:{stable_hash(cleaned, length=16)}"


def json_text(payload: dict[str, Any]) -> str:
    cleaned = {
        str(key): (
            value.item()
            if isinstance(value, np.generic)
            else "" if value is None or pd.isna(value) else value
        )
        for key, value in payload.items()
    }
    return json.dumps(cleaned, ensure_ascii=False, sort_keys=True)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def atomic_write_csv(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.stem}_", suffix=".tmp.csv", dir=path.parent
    )
    os.close(descriptor)
    temporary = Path(temporary_name)
    try:
        frame.to_csv(temporary, index=False, encoding="utf-8-sig")
        temporary.replace(path)
    finally:
        if temporary.exists():
            temporary.unlink()


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


def first_nonempty(values: Iterable[Any]) -> str:
    for value in values:
        cleaned = text(value)
        if cleaned:
            return cleaned
    return ""


class GraphTables:
    """Deduplicated node/edge accumulator with deterministic identifiers."""

    def __init__(self, dataset_version: str, graph_version: str) -> None:
        self.dataset_version = dataset_version
        self.graph_version = graph_version
        self.nodes: dict[str, dict[str, Any]] = {}
        self.outcome_nodes: dict[str, dict[str, Any]] = {}
        self.edges: dict[str, dict[str, Any]] = {}
        self.outcome_edges: dict[str, dict[str, Any]] = {}

    def add_node(
        self,
        node_id: str,
        node_type: str,
        name: Any,
        *,
        symbol: Any = "",
        valid_from: Any = "",
        valid_to: Any = "",
        source_news_id: Any = "",
        split: Any = "",
        prediction_time_safe: bool = True,
        attributes: dict[str, Any] | None = None,
    ) -> None:
        target = self.nodes if prediction_time_safe else self.outcome_nodes
        row = {
            "node_id": node_id,
            "node_type": node_type,
            "name": text(name),
            "symbol": text(symbol),
            "valid_from": text(valid_from),
            "valid_to": text(valid_to),
            "source_news_id": text(source_news_id),
            "split": text(split),
            "prediction_time_safe": boolean_text(prediction_time_safe),
            "attributes_json": json_text(attributes or {}),
            "dataset_version": self.dataset_version,
            "graph_version": self.graph_version,
        }
        existing = target.get(node_id)
        if existing is not None and (
            existing["node_type"] != row["node_type"]
            or existing["name"] != row["name"]
        ):
            raise ValueError(f"Conflicting node definition: {node_id}")
        target[node_id] = existing or row

    def add_edge(
        self,
        source_node_id: str,
        relation_type: str,
        target_node_id: str,
        *,
        event_time: Any = "",
        available_at: Any = "",
        valid_from: Any = "",
        valid_to: Any = "",
        split: Any = "",
        prediction_time_safe: bool = True,
        source_news_id: Any = "",
        source_url: Any = "",
        evidence_text: Any = "",
        confidence: Any = "",
        extraction_method: Any = "",
        review_status: Any = "",
        attributes: dict[str, Any] | None = None,
    ) -> None:
        edge_id = "edge:" + stable_hash(
            source_node_id,
            relation_type,
            target_node_id,
            event_time,
            source_news_id,
            length=24,
        )
        row = {
            "edge_id": edge_id,
            "source_node_id": source_node_id,
            "relation_type": relation_type,
            "target_node_id": target_node_id,
            "event_time": text(event_time),
            "available_at": text(available_at),
            "valid_from": text(valid_from),
            "valid_to": text(valid_to),
            "split": text(split),
            "prediction_time_safe": boolean_text(prediction_time_safe),
            "source_news_id": text(source_news_id),
            "source_url": text(source_url),
            "evidence_text": text(evidence_text),
            "confidence": text(confidence),
            "extraction_method": text(extraction_method),
            "review_status": text(review_status),
            "attributes_json": json_text(attributes or {}),
            "dataset_version": self.dataset_version,
            "graph_version": self.graph_version,
        }
        target = self.edges if prediction_time_safe else self.outcome_edges
        existing = target.get(edge_id)
        if existing is not None and existing != row:
            raise ValueError(f"Conflicting edge definition: {edge_id}")
        target[edge_id] = row

    def frames(self) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        nodes = pd.DataFrame(self.nodes.values(), columns=NODE_COLUMNS)
        edges = pd.DataFrame(self.edges.values(), columns=EDGE_COLUMNS)
        outcome_nodes = pd.DataFrame(
            self.outcome_nodes.values(), columns=NODE_COLUMNS
        )
        outcome_edges = pd.DataFrame(
            self.outcome_edges.values(), columns=EDGE_COLUMNS
        )
        return tuple(
            frame.sort_values(frame.columns[0]).reset_index(drop=True)
            for frame in (nodes, edges, outcome_nodes, outcome_edges)
        )


def read_inputs(
    dataset_path: Path, stock_path: Path, ontology_path: Path
) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, Any]]:
    dataset = pd.read_csv(
        dataset_path, dtype=str, keep_default_na=False, low_memory=False
    )
    missing = sorted(REQUIRED_COLUMNS - set(dataset.columns))
    if missing:
        raise ValueError(f"Dataset is missing required KG columns: {missing}")
    if dataset["sample_id"].duplicated().any():
        raise ValueError("sample_id must be unique before building the KG")
    dataset["published_date"] = pd.to_datetime(
        dataset["published_date"], errors="coerce"
    )
    if dataset["published_date"].isna().any():
        raise ValueError("Invalid published_date in canonical dataset")
    dataset = dataset.sort_values(
        ["published_date", "news_id", "symbol", "sample_id"]
    ).reset_index(drop=True)

    stocks = pd.read_csv(stock_path, dtype=str, keep_default_na=False)
    ontology = yaml.safe_load(ontology_path.read_text(encoding="utf-8"))
    return dataset, stocks, ontology


def add_reference_layer(
    tables: GraphTables, dataset: pd.DataFrame, stocks: pd.DataFrame
) -> None:
    used_symbols = set(dataset["symbol"])
    reference = stocks[stocks["symbol"].isin(used_symbols)].copy()
    missing = sorted(used_symbols - set(reference["symbol"]))
    if missing:
        raise ValueError(f"Symbols missing from stocks_master.csv: {missing}")

    for _, row in reference.sort_values("symbol").iterrows():
        symbol = text(row["symbol"]).upper()
        company = text(row["company"])
        industry = text(row["industry"])
        exchange = text(row["exchange"]).upper()
        index_symbol = first_nonempty(
            dataset.loc[dataset["symbol"].eq(symbol), "index_symbol"]
        )

        stock_node = f"stock:{symbol}"
        company_node = entity_id("company", company)
        industry_node = entity_id("industry", industry)
        exchange_node = f"exchange:{exchange}"
        index_node = f"index:{index_symbol}"

        tables.add_node(
            stock_node,
            "Stock",
            symbol,
            symbol=symbol,
            attributes={"company": company, "industry": industry, "exchange": exchange},
        )
        tables.add_node(
            company_node,
            "Company",
            company,
            attributes={"reference_symbol": symbol},
        )
        tables.add_node(industry_node, "Industry", industry)
        tables.add_node(exchange_node, "Exchange", exchange)
        tables.add_node(index_node, "MarketIndex", index_symbol, symbol=index_symbol)

        static_attributes = {
            "temporal_assumption": "REFERENCE_SNAPSHOT_ASSUMED_VALID_2019_2022"
        }
        for relation, target_node in (
            ("REPRESENTS", company_node),
            ("BELONGS_TO", industry_node),
            ("LISTED_ON", exchange_node),
            ("BENCHMARKED_BY", index_node),
        ):
            tables.add_edge(
                stock_node,
                relation,
                target_node,
                prediction_time_safe=True,
                confidence="MEDIUM",
                extraction_method="STOCK_REFERENCE_MASTER",
                review_status="REFERENCE_DATA",
                attributes=static_attributes,
            )

    for industry, group in reference.groupby("industry", sort=True):
        symbols = sorted(group["symbol"].astype(str).str.upper().unique())
        for position, source_symbol in enumerate(symbols):
            for target_symbol in symbols[position + 1 :]:
                tables.add_edge(
                    f"stock:{source_symbol}",
                    "RELATED_TO",
                    f"stock:{target_symbol}",
                    prediction_time_safe=True,
                    confidence="MEDIUM",
                    extraction_method="DERIVED_SAME_INDUSTRY",
                    review_status="DERIVED_REFERENCE_RELATION",
                    attributes={
                        "basis": "SAME_INDUSTRY",
                        "industry": text(industry),
                        "symmetric": True,
                        "temporal_assumption": (
                            "REFERENCE_SNAPSHOT_ASSUMED_VALID_2019_2022"
                        ),
                    },
                )


def add_news_event_layer(tables: GraphTables, dataset: pd.DataFrame) -> None:
    for news_id, group in dataset.groupby("news_id", sort=True):
        first = group.iloc[0]
        published_date = first["published_date"].date().isoformat()
        split = text(first["split"])
        news_node = f"news:{news_id}"
        source_node = entity_id("source", first["source"])
        time_node = f"time:{published_date}"

        tables.add_node(
            news_node,
            "News",
            first["title"],
            valid_from=published_date,
            source_news_id=news_id,
            split=split,
            attributes={
                "url": first["url"],
                "category": first.get("category", ""),
                "content_length": first.get("content_length", ""),
                "publication_time_resolution": "DATE_ONLY",
            },
        )
        tables.add_node(source_node, "Source", first["source"])
        tables.add_node(
            time_node,
            "Time",
            published_date,
            valid_from=published_date,
            attributes={"resolution": "DATE_ONLY"},
        )
        common = {
            "event_time": published_date,
            "available_at": published_date,
            "valid_from": published_date,
            "split": split,
            "source_news_id": news_id,
            "source_url": first["url"],
            "confidence": "HIGH",
            "extraction_method": "DATASET_METADATA",
            "review_status": "SOURCE_TRACEABLE",
        }
        tables.add_edge(news_node, "PUBLISHED_BY", source_node, **common)
        tables.add_edge(news_node, "PUBLISHED_AT", time_node, **common)

        for _, row in group.sort_values("sample_id").iterrows():
            sample_id = text(row["sample_id"])
            symbol = text(row["symbol"]).upper()
            stock_node = f"stock:{symbol}"
            event_node = f"event:{sample_id}"
            sentiment = text(row["sentiment"]).upper()
            sentiment_node = f"sentiment:{sentiment}"

            tables.add_node(
                event_node,
                "Event",
                f"{text(row['event_type'])}:{symbol}:{published_date}",
                symbol=symbol,
                valid_from=published_date,
                source_news_id=news_id,
                split=split,
                attributes={
                    "sample_id": sample_id,
                    "event_type": row["event_type"],
                    "event_type_detail": row["event_type_detail"],
                    "impact_level": row["impact_level"],
                    "affected_scope": row["affected_scope"],
                    "relation_directness": row["relation_directness"],
                    "reason": row.get("reason", ""),
                    "labeling_method": row["labeling_method"],
                },
            )
            tables.add_node(sentiment_node, "Sentiment", sentiment)

            semantic_common = {
                "event_time": published_date,
                "available_at": published_date,
                "valid_from": published_date,
                "split": split,
                "source_news_id": news_id,
                "source_url": row["url"],
                "confidence": row["confidence"],
                "extraction_method": row["labeling_method"],
                "review_status": "AUTO_EXTRACTED_UNREVIEWED",
            }
            tables.add_edge(
                news_node,
                "MENTIONS",
                stock_node,
                evidence_text=row["symbol_evidence"],
                attributes={
                    "sample_id": sample_id,
                    "relation_directness": row["relation_directness"],
                    "mention_count": row.get("mention_count", ""),
                    "entity_confidence": row.get("entity_confidence", ""),
                },
                **semantic_common,
            )
            tables.add_edge(
                news_node,
                "CONTAINS_EVENT",
                event_node,
                evidence_text=row.get("reason", ""),
                attributes={
                    "sample_id": sample_id,
                    "event_type": row["event_type"],
                    "event_type_detail": row["event_type_detail"],
                },
                **semantic_common,
            )
            tables.add_edge(
                event_node,
                "AFFECTS",
                stock_node,
                evidence_text=row["symbol_evidence"],
                attributes={
                    "sample_id": sample_id,
                    "impact_level": row["impact_level"],
                    "affected_scope": row["affected_scope"],
                    "relation_directness": row["relation_directness"],
                },
                **semantic_common,
            )
            tables.add_edge(
                event_node,
                "HAS_SENTIMENT",
                sentiment_node,
                evidence_text=row.get("reason", ""),
                attributes={"sample_id": sample_id},
                **semantic_common,
            )


def add_outcome_layer(tables: GraphTables, dataset: pd.DataFrame) -> None:
    for _, row in dataset.iterrows():
        sample_id = text(row["sample_id"])
        event_node = f"event:{sample_id}"
        stock_node = f"stock:{text(row['symbol']).upper()}"
        index_node = f"index:{text(row['index_symbol'])}"
        published_date = row["published_date"].date().isoformat()

        for horizon in HORIZONS:
            date_column = f"date_t_plus_{horizon}"
            if date_column not in row.index:
                continue
            available_at = text(row[date_column])
            direction = text(row.get(f"primary_reaction_direction_{horizon}d", ""))
            abnormal_return = text(
                row.get(f"primary_abnormal_return_{horizon}d", "")
            )
            impact_score = text(row.get(f"primary_impact_score_{horizon}d", ""))
            impact_band = text(row.get(f"primary_impact_band_{horizon}d", ""))
            target_price = text(row.get(f"target_price_{horizon}d", ""))
            if not available_at or not direction:
                continue

            reaction_node = f"reaction:{sample_id}:{horizon}d"
            attributes = {
                "sample_id": sample_id,
                "horizon_sessions": horizon,
                "direction": direction,
                "abnormal_return": abnormal_return,
                "impact_score": impact_score,
                "impact_band": impact_band,
                "target_price": target_price,
                "ground_truth_type": row.get("ground_truth_type", ""),
                "causal_claim_allowed": row.get("causal_claim_allowed", ""),
            }
            tables.add_node(
                reaction_node,
                "MarketReaction",
                f"{text(row['symbol'])}:{horizon}d:{available_at}",
                symbol=row["symbol"],
                valid_from=available_at,
                source_news_id=row["news_id"],
                split=row["split"],
                prediction_time_safe=False,
                attributes=attributes,
            )
            common = {
                "event_time": published_date,
                "available_at": available_at,
                "valid_from": available_at,
                "split": row["split"],
                "prediction_time_safe": False,
                "source_news_id": row["news_id"],
                "source_url": row["url"],
                "confidence": row.get("ground_truth_confidence", ""),
                "extraction_method": "PRICE_DERIVED_GROUND_TRUTH",
                "review_status": "OUTCOME_ONLY_NOT_MODEL_INPUT",
                "attributes": attributes,
            }
            tables.add_edge(
                event_node, "HAS_REACTION", reaction_node, **common
            )
            tables.add_edge(
                reaction_node, "OBSERVED_FOR", stock_node, **common
            )
            tables.add_edge(
                reaction_node, "BENCHMARKED_AGAINST", index_node, **common
            )


def same_industry_projection(dataset: pd.DataFrame) -> nx.Graph:
    graph = nx.Graph()
    symbol_industry = (
        dataset[["symbol", "industry"]]
        .drop_duplicates("symbol")
        .sort_values("symbol")
    )
    for _, row in symbol_industry.iterrows():
        graph.add_node(text(row["symbol"]).upper(), industry=text(row["industry"]))
    for _, group in symbol_industry.groupby("industry", sort=True):
        symbols = sorted(group["symbol"].astype(str).str.upper().unique())
        for position, source in enumerate(symbols):
            for target in symbols[position + 1 :]:
                graph.add_edge(source, target, weight=1.0, basis="SAME_INDUSTRY")
    return graph


def add_comention_edges(graph: nx.Graph, date_rows: pd.DataFrame) -> None:
    for _, group in date_rows.groupby("news_id", sort=True):
        symbols = sorted(group["symbol"].astype(str).str.upper().unique())
        for position, source in enumerate(symbols):
            for target in symbols[position + 1 :]:
                if graph.has_edge(source, target):
                    graph[source][target]["weight"] = (
                        float(graph[source][target].get("weight", 1.0)) + 1.0
                    )
                    graph[source][target]["basis"] = "INDUSTRY_OR_CO_MENTION"
                else:
                    graph.add_edge(
                        source,
                        target,
                        weight=1.0,
                        basis="HISTORICAL_CO_MENTION",
                    )


def compute_temporal_graph_features(
    dataset: pd.DataFrame, graph_version: str
) -> pd.DataFrame:
    """Compute causal graph features using only strictly earlier articles."""

    graph = same_industry_projection(dataset)
    history = dataset.iloc[0:0].copy()
    result: list[dict[str, Any]] = []

    for published_date, current in dataset.groupby("published_date", sort=True):
        degree = nx.degree_centrality(graph)
        betweenness = nx.betweenness_centrality(graph, normalized=True)
        closeness = nx.closeness_centrality(graph)
        cutoff = published_date - pd.Timedelta(days=1)
        recent_cutoff = published_date - pd.Timedelta(days=30)
        recent = history[history["published_date"].ge(recent_cutoff)]

        for _, row in current.iterrows():
            symbol = text(row["symbol"]).upper()
            industry = text(row["industry"])
            event_type = text(row["event_type"])

            stock_history = history[history["symbol"].eq(symbol)]
            stock_recent = recent[recent["symbol"].eq(symbol)]
            industry_recent = recent[recent["industry"].eq(industry)]
            same_event_recent = stock_recent[
                stock_recent["event_type"].eq(event_type)
            ]
            industry_same_event = industry_recent[
                industry_recent["event_type"].eq(event_type)
            ]
            unique_industry_news = industry_recent.drop_duplicates("news_id")
            sentiment_values = unique_industry_news["sentiment"].map(
                SENTIMENT_VALUE
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
                    "stock_degree_centrality": degree.get(symbol, 0.0),
                    "stock_betweenness_centrality": betweenness.get(symbol, 0.0),
                    "stock_closeness_centrality": closeness.get(symbol, 0.0),
                    "stock_projection_nodes": graph.number_of_nodes(),
                    "stock_projection_edges": graph.number_of_edges(),
                    "historical_stock_news_count": stock_history[
                        "news_id"
                    ].nunique(),
                    "historical_stock_event_count": len(stock_history),
                    "historical_stock_positive_count": int(
                        stock_history["sentiment"].eq("POSITIVE").sum()
                    ),
                    "historical_stock_negative_count": int(
                        stock_history["sentiment"].eq("NEGATIVE").sum()
                    ),
                    "historical_stock_neutral_count": int(
                        stock_history["sentiment"].eq("NEUTRAL").sum()
                    ),
                    "recent_30d_stock_news_count": stock_recent[
                        "news_id"
                    ].nunique(),
                    "recent_30d_stock_positive_count": int(
                        stock_recent["sentiment"].eq("POSITIVE").sum()
                    ),
                    "recent_30d_stock_negative_count": int(
                        stock_recent["sentiment"].eq("NEGATIVE").sum()
                    ),
                    "recent_30d_industry_news_count": unique_industry_news[
                        "news_id"
                    ].nunique(),
                    "recent_30d_industry_sentiment_mean": (
                        float(sentiment_values.mean())
                        if not sentiment_values.empty
                        else 0.0
                    ),
                    "recent_30d_same_event_type_count": len(same_event_recent),
                    "recent_30d_industry_stocks_same_event_type": (
                        industry_same_event["symbol"].nunique()
                    ),
                    "dataset_version": row["dataset_version"],
                    "graph_version": graph_version,
                }
            )

        add_comention_edges(graph, current)
        history = pd.concat([history, current], ignore_index=True)

    return pd.DataFrame(result, columns=FEATURE_COLUMNS).sort_values(
        ["published_date", "news_id", "symbol", "sample_id"]
    )


def build_networkx_graph(nodes: pd.DataFrame, edges: pd.DataFrame) -> nx.MultiDiGraph:
    graph = nx.MultiDiGraph(
        name="FinNexus prediction-time temporal knowledge graph"
    )
    for row in nodes.to_dict("records"):
        attributes = {
            key: text(value)
            for key, value in row.items()
            if key != "node_id"
        }
        graph.add_node(row["node_id"], **attributes)
    for row in edges.to_dict("records"):
        attributes = {
            key: text(value)
            for key, value in row.items()
            if key not in {"source_node_id", "target_node_id"}
        }
        graph.add_edge(
            row["source_node_id"],
            row["target_node_id"],
            key=row["edge_id"],
            **attributes,
        )
    return graph


def graph_summary(
    dataset_path: Path,
    ontology_path: Path,
    dataset: pd.DataFrame,
    nodes: pd.DataFrame,
    edges: pd.DataFrame,
    outcome_nodes: pd.DataFrame,
    outcome_edges: pd.DataFrame,
    features: pd.DataFrame,
    graph: nx.MultiDiGraph,
) -> dict[str, Any]:
    undirected = graph.to_undirected()
    weak_components = list(nx.connected_components(undirected))
    return {
        "graph_version": first_nonempty(nodes["graph_version"]),
        "ontology_version": yaml.safe_load(
            ontology_path.read_text(encoding="utf-8")
        )["ontology_version"],
        "dataset_version": first_nonempty(dataset["dataset_version"]),
        "input_dataset": str(dataset_path.relative_to(ROOT)),
        "input_sha256": sha256(dataset_path),
        "rows": int(len(dataset)),
        "unique_news": int(dataset["news_id"].nunique()),
        "unique_symbols": int(dataset["symbol"].nunique()),
        "prediction_nodes": int(len(nodes)),
        "prediction_edges": int(len(edges)),
        "outcome_nodes": int(len(outcome_nodes)),
        "outcome_edges": int(len(outcome_edges)),
        "temporal_graph_feature_rows": int(len(features)),
        "node_types": {
            str(key): int(value)
            for key, value in nodes["node_type"].value_counts().sort_index().items()
        },
        "prediction_relation_types": {
            str(key): int(value)
            for key, value in edges["relation_type"]
            .value_counts()
            .sort_index()
            .items()
        },
        "outcome_relation_types": {
            str(key): int(value)
            for key, value in outcome_edges["relation_type"]
            .value_counts()
            .sort_index()
            .items()
        },
        "date_range": {
            "min": dataset["published_date"].min().date().isoformat(),
            "max": dataset["published_date"].max().date().isoformat(),
        },
        "weakly_connected_components": len(weak_components),
        "largest_component_nodes": max(map(len, weak_components), default=0),
        "prediction_graph_density": float(nx.density(graph)),
        "semantic_edge_review_status": {
            str(key): int(value)
            for key, value in edges["review_status"].value_counts().items()
        },
        "temporal_policy": {
            "history_rule": "STRICTLY_BEFORE_PUBLICATION_DATE",
            "same_day_history_allowed": False,
            "publication_time_resolution": "DATE_ONLY",
            "outcomes_separated": True,
        },
        "scientific_limitations": [
            "Event and sentiment relations are weak-rule extractions unless explicitly reviewed.",
            "Publication time is unavailable, so same-day history is excluded.",
            "Reference company/industry/exchange mappings lack historical effective dates.",
            "MarketReaction is an observed association, not causal impact.",
        ],
    }


def write_graphml(graph: nx.MultiDiGraph, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.stem}_", suffix=".tmp.graphml", dir=path.parent
    )
    os.close(descriptor)
    temporary = Path(temporary_name)
    try:
        nx.write_graphml(graph, temporary, encoding="utf-8")
        temporary.replace(path)
    finally:
        if temporary.exists():
            temporary.unlink()


def write_build_report(summary: dict[str, Any], path: Path) -> None:
    lines = [
        "# FinNexus temporal Knowledge Graph V1",
        "",
        f"- Dataset: `{summary['dataset_version']}`.",
        f"- Graph: `{summary['graph_version']}`.",
        f"- Prediction-time nodes: {summary['prediction_nodes']:,}.",
        f"- Prediction-time edges: {summary['prediction_edges']:,}.",
        f"- Outcome nodes: {summary['outcome_nodes']:,}.",
        f"- Outcome edges: {summary['outcome_edges']:,}.",
        (
            "- Leakage-safe temporal feature rows: "
            f"{summary['temporal_graph_feature_rows']:,}."
        ),
        "",
        "## Temporal contract",
        "",
        "- Prediction graph contains no future price outcome.",
        "- Market reactions are stored in separate outcome tables.",
        "- Historical graph features use only articles strictly before publication date.",
        "- Same-day news is excluded because article publication time is unavailable.",
        "",
        "## Scientific interpretation",
        "",
        "- Semantic event edges remain weak-rule, unreviewed training relations.",
        "- The frozen human consensus is evaluation-only and is not merged here.",
        "- MarketReaction records observed post-news association, not causality.",
    ]
    atomic_write_text("\n".join(lines) + "\n", path)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build the leakage-safe FinNexus temporal KG."
    )
    parser.add_argument("--input", default=str(DEFAULT_INPUT))
    parser.add_argument("--stocks", default=str(DEFAULT_STOCKS))
    parser.add_argument("--ontology", default=str(DEFAULT_ONTOLOGY))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--quality-dir", default=str(DEFAULT_QUALITY))
    args = parser.parse_args()

    dataset_path = Path(args.input)
    stocks_path = Path(args.stocks)
    ontology_path = Path(args.ontology)
    output_dir = Path(args.output_dir)
    quality_dir = Path(args.quality_dir)
    dataset, stocks, ontology = read_inputs(
        dataset_path, stocks_path, ontology_path
    )
    graph_version = ontology["graph_version"]
    dataset_version = first_nonempty(dataset["dataset_version"])
    tables = GraphTables(dataset_version, graph_version)

    add_reference_layer(tables, dataset, stocks)
    add_news_event_layer(tables, dataset)
    add_outcome_layer(tables, dataset)
    nodes, edges, outcome_nodes, outcome_edges = tables.frames()
    features = compute_temporal_graph_features(dataset, graph_version)
    graph = build_networkx_graph(nodes, edges)

    outputs = {
        "nodes": output_dir / "nodes.csv",
        "edges": output_dir / "edges.csv",
        "outcome_nodes": output_dir / "outcome_nodes.csv",
        "outcome_edges": output_dir / "outcome_edges.csv",
        "features": output_dir / "temporal_graph_features.csv",
        "graphml": output_dir / "finnexus_prediction_graph.graphml",
        "summary": output_dir / "kg_summary.json",
        "report": quality_dir / "kg_build_report.md",
    }
    for frame, key in (
        (nodes, "nodes"),
        (edges, "edges"),
        (outcome_nodes, "outcome_nodes"),
        (outcome_edges, "outcome_edges"),
        (features, "features"),
    ):
        atomic_write_csv(frame, outputs[key])
    write_graphml(graph, outputs["graphml"])

    summary = graph_summary(
        dataset_path,
        ontology_path,
        dataset,
        nodes,
        edges,
        outcome_nodes,
        outcome_edges,
        features,
        graph,
    )
    summary["output_sha256"] = {
        key: sha256(path)
        for key, path in outputs.items()
        if key not in {"summary", "report"}
    }
    atomic_write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        outputs["summary"],
    )
    write_build_report(summary, outputs["report"])

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"Prediction graph: {outputs['graphml']}")


if __name__ == "__main__":
    main()
