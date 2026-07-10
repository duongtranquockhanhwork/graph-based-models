import networkx as nx
from typing import Dict, List, Optional
import json
import os

from sqlalchemy.orm import Session

_dict_path = os.path.join(os.path.dirname(__file__), "../../data/stock_dictionary.json")
with open(_dict_path, "r", encoding="utf-8") as f:
    STOCK_DICT = json.load(f)

G = nx.DiGraph()

NODE_COLORS = {
    "news": "#3B82F6",
    "stock": "#10B981",
    "company": "#8B5CF6",
    "industry": "#F59E0B",
    "event": "#EF4444",
    "sentiment": "#F97316",
}


def add_news_to_graph(news_id: int, analysis: Dict) -> None:
    news_node = f"news_{news_id}"
    G.add_node(news_node, node_type="news", label=f"News #{news_id}")

    for stock in analysis.get("stocks", []):
        info = STOCK_DICT.get(stock, {})
        G.add_node(stock, node_type="stock", label=stock,
                   company=info.get("company", ""),
                   industry=info.get("industry", ""))
        G.add_edge(news_node, stock, relation="mentions")

        company = info.get("company")
        if company:
            G.add_node(company, node_type="company", label=company)
            G.add_edge(stock, company, relation="represents")

        industry = info.get("industry")
        if industry:
            ind_node = f"industry_{industry}"
            G.add_node(ind_node, node_type="industry", label=industry)
            G.add_edge(stock, ind_node, relation="belongs_to")

    for event in analysis.get("events", []):
        ev_node = f"event_{event}"
        G.add_node(ev_node, node_type="event", label=event.replace("_", " ").title())
        G.add_edge(news_node, ev_node, relation="contains_event")
        for stock in analysis.get("stocks", []):
            G.add_edge(ev_node, stock, relation="affects")

    sentiment = analysis.get("sentiment", "Neutral")
    sent_node = f"sentiment_{sentiment}"
    G.add_node(sent_node, node_type="sentiment", label=sentiment)
    G.add_edge(news_node, sent_node, relation="has_sentiment")

    stocks = analysis.get("stocks", [])
    for i in range(len(stocks)):
        for j in range(i + 1, len(stocks)):
            if STOCK_DICT.get(stocks[i], {}).get("industry") == STOCK_DICT.get(stocks[j], {}).get("industry"):
                if not G.has_edge(stocks[i], stocks[j]):
                    G.add_edge(stocks[i], stocks[j], relation="same_industry")


def rebuild_graph_from_db(db: Session) -> None:
    from app.models.news import NewsArticle

    G.clear()
    articles = db.query(NewsArticle).filter(NewsArticle.graph_built == True).all()  # noqa: E712
    for n in articles:
        add_news_to_graph(n.id, {
            "stocks": n.stocks_mentioned or [],
            "events": n.events_detected or [],
            "sentiment": n.sentiment or "Neutral",
        })


def get_graph_data(stock_filter: Optional[str] = None,
                   industry_filter: Optional[str] = None,
                   limit: int = 200) -> Dict:
    if G.number_of_nodes() == 0:
        return {"nodes": [], "edges": [], "metadata": {"total_nodes": 0, "total_edges": 0}}

    subgraph = G
    if stock_filter and stock_filter in G:
        nodes = set(nx.ego_graph(G, stock_filter, radius=2).nodes())
        subgraph = G.subgraph(nodes)
    elif industry_filter:
        ind_node = f"industry_{industry_filter}"
        keep = {n for n, d in G.nodes(data=True) if d.get("industry") == industry_filter}
        keep.add(ind_node)
        for s in list(keep):
            if s in G:
                keep.update(nx.ego_graph(G, s, radius=1).nodes())
        subgraph = G.subgraph(keep)

    centrality = nx.degree_centrality(subgraph) if subgraph.number_of_nodes() > 0 else {}
    node_list = list(subgraph.nodes(data=True))[:limit]

    nodes = []
    node_ids = set()
    for node_id, data in node_list:
        ntype = data.get("node_type", "news")
        size = 5 + centrality.get(node_id, 0) * 30
        nodes.append({
            "id": str(node_id),
            "label": data.get("label", str(node_id)),
            "type": ntype,
            "color": NODE_COLORS.get(ntype, "#666"),
            "size": round(size, 2),
            "properties": {k: v for k, v in data.items() if k not in ("node_type", "label")},
        })
        node_ids.add(str(node_id))

    edges = [
        {"source": str(s), "target": str(t), "relation": d.get("relation", "related"), "weight": 1.0}
        for s, t, d in subgraph.edges(data=True)
        if str(s) in node_ids and str(t) in node_ids
    ]

    return {
        "nodes": nodes,
        "edges": edges,
        "metadata": {
            "total_nodes": subgraph.number_of_nodes(),
            "total_edges": subgraph.number_of_edges(),
            "displayed_nodes": len(nodes),
        },
    }


def get_graph_features(stock_symbol: str) -> Dict:
    if stock_symbol not in G:
        return {}
    try:
        deg = nx.degree_centrality(G).get(stock_symbol, 0)
        btwn = nx.betweenness_centrality(G, k=min(50, G.number_of_nodes())).get(stock_symbol, 0)
        preds = list(G.predecessors(stock_symbol))
        news_nodes = [n for n in preds if str(n).startswith("news_")]
        pos, neg = 0, 0
        for nn in news_nodes:
            for succ in G.successors(nn):
                s = str(succ)
                if s.startswith("sentiment_Positive"):
                    pos += 1
                elif s.startswith("sentiment_Negative"):
                    neg += 1
        return {
            "degree_centrality": round(deg, 4),
            "betweenness_centrality": round(btwn, 4),
            "mention_frequency": len(news_nodes),
            "positive_news_count": pos,
            "negative_news_count": neg,
            "sentiment_ratio": round(pos / (pos + neg + 0.001), 4),
        }
    except Exception:
        return {}


def get_graph_stats() -> Dict:
    counts = {}
    for _, d in G.nodes(data=True):
        t = d.get("node_type", "unknown")
        counts[t] = counts.get(t, 0) + 1
    return {
        "total_nodes": G.number_of_nodes(),
        "total_edges": G.number_of_edges(),
        "node_types": counts,
    }
