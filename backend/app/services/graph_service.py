import networkx as nx
from typing import Dict, List, Optional
import json
import os

from sqlalchemy.orm import Session

from app.services.nlp_service import EVENT_LABELS_VI

_dict_path = os.path.join(os.path.dirname(__file__), "../../data/stock_dictionary.json")
with open(_dict_path, "r", encoding="utf-8") as f:
    STOCK_DICT = json.load(f)

# Trước đây đây là một biến toàn cục duy nhất, được MUTATE dần qua từng lần
# phân tích bài báo (add_news_to_graph), và mọi người dùng đọc chung một đồ
# thị. Giờ mỗi khách hàng chỉ được thấy đồ thị dựng từ CHÍNH những bài họ đã
# thêm — không thể làm điều đó bằng cách gắn nhãn chủ sở hữu lên từng nút,
# vì một nút "mã cổ phiếu" hay "ngành" là khái niệm dùng chung, có thể được
# nhiều người nhắc tới. Thay vào đó, đồ thị được DỰNG LẠI TỪ ĐẦU mỗi lần đọc,
# trực tiếp từ NewsArticle đã lọc theo owner_id — xem build_graph() bên dưới.
# Với vài chục tới vài trăm bài báo, việc này rẻ hơn nhiều so với cái giá
# phải trả để gắn nhãn sở hữu đúng đắn lên một đồ thị dùng chung, và tiện thể
# vá một lỗi có sẵn: xoá bài báo trước đây không gỡ nút/cạnh cũ khỏi đồ thị
# chung cho tới khi server khởi động lại.

# Tiền tố pháp lý lặp lại ở gần như mọi tên công ty VN. VIẾT TẮT chúng thay vì
# xoá hẳn: xoá đi thì "Công ty Cổ phần FPT" thành "FPT", trùng y hệt nhãn của
# nút cổ phiếu FPT bên cạnh và người xem không phân biệt được hai nút.
_COMPANY_PREFIXES = (
    ("Ngân hàng Thương mại Cổ phần ", "NH "),
    ("Ngân hàng TMCP ", "NH "),
    ("Ngân hàng ", "NH "),
    ("Tổng Công ty Cổ phần ", "TCT "),
    ("Tổng Công ty ", "TCT "),
    ("Công ty Cổ phần Tập đoàn ", "CTCP TĐ "),
    ("Công ty Cổ phần ", "CTCP "),
    ("Tập đoàn ", "TĐ "),
)


def _short_company(name: str, symbol: Optional[str] = None) -> str:
    """Rút gọn tên công ty cho vừa một nút đồ thị, nhưng vẫn khác nhãn mã.

    Ưu tiên tên thương hiệu trong ngoặc đơn ("Vinamilk", "PV Gas") vì người đọc
    nhận ra ngay. Nếu tên đó trùng chính mã cổ phiếu thì bỏ qua, vì hai nút
    cạnh nhau mang cùng một chữ là vô nghĩa.
    """
    if "(" in name and ")" in name:
        brand = name[name.index("(") + 1 : name.rindex(")")].strip()
        if 1 < len(brand) <= 28 and brand.upper() != (symbol or "").upper():
            return brand

    short = name
    for prefix, abbrev in _COMPANY_PREFIXES:
        if short.startswith(prefix):
            short = abbrev + short[len(prefix):]
            break
    return short if len(short) <= 28 else short[:27].rstrip() + "…"

NODE_COLORS = {
    "news": "#3B82F6",
    "stock": "#10B981",
    "company": "#8B5CF6",
    "industry": "#F59E0B",
    "event": "#EF4444",
    "sentiment": "#F97316",
}


# Nhãn hiển thị cho nút cảm xúc. Đồ thị được người Việt đọc, nên nhãn phải là
# tiếng Việt — trước đây nút hiện "Positive"/"Neutral"/"Negative".
SENTIMENT_LABELS_VI = {
    "Positive": "Tích cực",
    "Negative": "Tiêu cực",
    "Neutral": "Trung lập",
}


def _news_label(news_id: int, title: Optional[str]) -> str:
    """Nhãn nút tin tức.

    Trước đây là "News #12" — một con số không nói lên điều gì, khiến đồ thị
    đầy những nút vô danh. Dùng tiêu đề bài báo, cắt ngắn để không phá bố cục.
    """
    if not title:
        return f"Tin #{news_id}"
    clean = " ".join(title.split())
    return clean if len(clean) <= 42 else clean[:41].rstrip() + "…"


def _add_news_to_graph(graph: nx.DiGraph, news_id: int, analysis: Dict, title: Optional[str] = None) -> None:
    news_node = f"news_{news_id}"
    graph.add_node(
        news_node,
        node_type="news",
        label=_news_label(news_id, title),
        title=title or "",
    )

    for stock in analysis.get("stocks", []):
        info = STOCK_DICT.get(stock, {})
        graph.add_node(stock, node_type="stock", label=stock,
                        company=info.get("company", ""),
                        industry=info.get("industry", ""))
        graph.add_edge(news_node, stock, relation="mentions")

        company = info.get("company")
        if company:
            # Tên công ty đầy đủ ("Công ty Cổ phần Sữa Việt Nam (Vinamilk)")
            # dài gấp nhiều lần đường kính nút. Giữ tên đầy đủ trong thuộc tính
            # để bảng bên hiển thị, còn nhãn trên đồ thị dùng bản rút gọn.
            graph.add_node(
                company,
                node_type="company",
                label=_short_company(company, stock),
                full_name=company,
            )
            graph.add_edge(stock, company, relation="represents")

        industry = info.get("industry")
        if industry:
            ind_node = f"industry_{industry}"
            graph.add_node(ind_node, node_type="industry", label=industry)
            graph.add_edge(stock, ind_node, relation="belongs_to")

    for event in analysis.get("events", []):
        ev_node = f"event_{event}"
        # EVENT_LABELS_VI là cùng bảng nhãn mà giao diện và bộ phân tích dùng,
        # nên một sự kiện hiện ra giống nhau ở đồ thị, dòng tin và thẻ tin.
        graph.add_node(
            ev_node,
            node_type="event",
            label=EVENT_LABELS_VI.get(event, event.replace("_", " ").title()),
        )
        graph.add_edge(news_node, ev_node, relation="contains_event")
        for stock in analysis.get("stocks", []):
            graph.add_edge(ev_node, stock, relation="affects")

    sentiment = analysis.get("sentiment", "Neutral")
    sent_node = f"sentiment_{sentiment}"
    graph.add_node(sent_node, node_type="sentiment", label=SENTIMENT_LABELS_VI.get(sentiment, sentiment))
    graph.add_edge(news_node, sent_node, relation="has_sentiment")

    stocks = analysis.get("stocks", [])
    for i in range(len(stocks)):
        for j in range(i + 1, len(stocks)):
            if STOCK_DICT.get(stocks[i], {}).get("industry") == STOCK_DICT.get(stocks[j], {}).get("industry"):
                if not graph.has_edge(stocks[i], stocks[j]):
                    graph.add_edge(stocks[i], stocks[j], relation="same_industry")


def build_graph(db: Session, owner_id: Optional[int] = None) -> nx.DiGraph:
    """Dựng một đồ thị MỚI từ DB, lọc theo owner_id khi có (None = admin, lấy
    toàn hệ thống). Xem chú thích đầu file — đây thay thế biến G toàn cục cũ."""
    from app.models.news import NewsArticle

    graph = nx.DiGraph()
    query = db.query(NewsArticle).filter(NewsArticle.graph_built == True)  # noqa: E712
    if owner_id is not None:
        query = query.filter(NewsArticle.owner_id == owner_id)
    for n in query.all():
        _add_news_to_graph(
            graph,
            n.id,
            {
                "stocks": n.stocks_mentioned or [],
                "events": n.events_detected or [],
                "sentiment": n.sentiment or "Neutral",
            },
            title=n.title,
        )
    return graph


def get_graph_data(
    db: Session,
    owner_id: Optional[int],
    stock_filter: Optional[str] = None,
    industry_filter: Optional[str] = None,
    limit: int = 200,
) -> Dict:
    graph = build_graph(db, owner_id)
    if graph.number_of_nodes() == 0:
        return {"nodes": [], "edges": [], "metadata": {"total_nodes": 0, "total_edges": 0}}

    subgraph = graph
    if stock_filter and stock_filter in graph:
        nodes = set(nx.ego_graph(graph, stock_filter, radius=2).nodes())
        subgraph = graph.subgraph(nodes)
    elif industry_filter:
        ind_node = f"industry_{industry_filter}"
        keep = {n for n, d in graph.nodes(data=True) if d.get("industry") == industry_filter}
        keep.add(ind_node)
        for s in list(keep):
            if s in graph:
                keep.update(nx.ego_graph(graph, s, radius=1).nodes())
        subgraph = graph.subgraph(keep)

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


def get_graph_features(db: Session, owner_id: Optional[int], stock_symbol: str) -> Dict:
    graph = build_graph(db, owner_id)
    if stock_symbol not in graph:
        return {}
    try:
        deg = nx.degree_centrality(graph).get(stock_symbol, 0)
        btwn = nx.betweenness_centrality(graph, k=min(50, graph.number_of_nodes())).get(stock_symbol, 0)
        preds = list(graph.predecessors(stock_symbol))
        news_nodes = [n for n in preds if str(n).startswith("news_")]
        pos, neg = 0, 0
        for nn in news_nodes:
            for succ in graph.successors(nn):
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


def get_graph_stats(db: Session, owner_id: Optional[int]) -> Dict:
    graph = build_graph(db, owner_id)
    counts = {}
    for _, d in graph.nodes(data=True):
        t = d.get("node_type", "unknown")
        counts[t] = counts.get(t, 0) + 1
    return {
        "total_nodes": graph.number_of_nodes(),
        "total_edges": graph.number_of_edges(),
        "node_types": counts,
    }
