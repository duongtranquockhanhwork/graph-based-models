import re
import json
import os
from typing import List, Dict, Tuple, Optional

_dict_path = os.path.join(os.path.dirname(__file__), "../../data/stock_dictionary.json")
with open(_dict_path, "r", encoding="utf-8") as f:
    STOCK_DICT = json.load(f)

COMPANY_TO_STOCK: Dict[str, str] = {}
for _symbol, _info in STOCK_DICT.items():
    for _alias in _info.get("aliases", []):
        COMPANY_TO_STOCK[_alias.lower()] = _symbol

POSITIVE_KEYWORDS = [
    "tăng", "tăng trưởng", "lãi", "lợi nhuận tăng", "doanh thu tăng",
    "tích cực", "phục hồi", "hợp đồng mới", "ký kết", "mở rộng",
    "thành công", "vượt kế hoạch", "khởi sắc", "đột phá", "tăng mạnh",
    "tăng vọt", "tăng cao", "tăng kỷ lục", "lợi nhuận cao", "dẫn đầu",
    "đầu tư mới", "ra mắt", "hợp tác", "liên doanh", "xuất khẩu tăng",
    "thị phần tăng", "cổ tức", "chia cổ tức", "trúng thầu", "thắng thầu",
]

NEGATIVE_KEYWORDS = [
    "giảm", "lỗ", "sụt giảm", "tiêu cực", "vi phạm", "xử phạt",
    "rủi ro", "khó khăn", "thua lỗ", "âm", "nợ xấu", "giảm mạnh",
    "giảm sâu", "sụt", "yếu", "đình chỉ", "thu hồi", "phạt",
    "thanh tra", "điều tra", "cảnh báo", "mất thị phần",
    "hủy hợp đồng", "thu hẹp", "sa thải", "cắt giảm",
]

EVENT_PATTERNS = {
    "profit_growth": ["lợi nhuận tăng", "lãi tăng", "doanh thu tăng", "lợi nhuận cao", "lãi kỷ lục"],
    "profit_decline": ["lợi nhuận giảm", "lãi giảm", "doanh thu giảm", "thua lỗ", "lỗ"],
    "dividend": ["cổ tức", "chia cổ tức", "trả cổ tức"],
    "merger": ["sáp nhập", "mua lại", "thâu tóm", "liên doanh", "hợp nhất"],
    "new_contract": ["hợp đồng mới", "ký kết hợp đồng", "trúng thầu", "thắng thầu", "ký hợp đồng"],
    "penalty": ["xử phạt", "vi phạm", "bị phạt", "cảnh báo vi phạm", "điều tra"],
    "leadership_change": ["bổ nhiệm", "miễn nhiệm", "thay đổi lãnh đạo", "tổng giám đốc mới", "từ chức"],
    "share_issuance": ["phát hành cổ phiếu", "tăng vốn", "phát hành thêm", "tăng vốn điều lệ"],
    "expansion": ["mở rộng", "đầu tư mới", "ra mắt sản phẩm", "mở thêm", "khởi công"],
}

EVENT_LABELS_VI = {
    "profit_growth": "Lợi nhuận/doanh thu tăng",
    "profit_decline": "Lợi nhuận/doanh thu giảm",
    "dividend": "Chia cổ tức",
    "merger": "Sáp nhập/mua lại",
    "new_contract": "Ký hợp đồng/trúng thầu mới",
    "penalty": "Vi phạm/xử phạt",
    "leadership_change": "Thay đổi lãnh đạo",
    "share_issuance": "Phát hành cổ phiếu/tăng vốn",
    "expansion": "Mở rộng đầu tư/kinh doanh",
}

# Từ khóa ngành nghề tổng quát, dùng để nhận diện ngành ngay cả khi bài báo
# không nhắc đến một mã cổ phiếu/công ty cụ thể nào trong stock_dictionary.
INDUSTRY_KEYWORDS = {
    "Ngân hàng": ["ngân hàng", "tín dụng", "lãi suất huy động", "ngành ngân hàng"],
    "Bất động sản": ["bất động sản", "địa ốc", "chung cư", "dự án nhà ở", "thị trường nhà đất"],
    "Chứng khoán": ["chứng khoán", "vn-index", "vnindex", "thị trường chứng khoán", "sàn giao dịch"],
    "Thép": ["ngành thép", "giá thép", "sản lượng thép", "tôn thép"],
    "Dầu khí": ["dầu khí", "giá dầu", "xăng dầu", "khí đốt", "petrovietnam"],
    "Công nghệ": ["công nghệ thông tin", "chuyển đổi số", "ngành công nghệ", "phần mềm"],
    "Hàng tiêu dùng": ["hàng tiêu dùng", "bán lẻ tiêu dùng", "fmcg"],
    "Đồ uống": ["ngành đồ uống", "bia rượu", "nước giải khát"],
    "Bán lẻ": ["ngành bán lẻ", "chuỗi bán lẻ", "siêu thị"],
    "Dược phẩm": ["ngành dược", "dược phẩm", "thuốc chữa bệnh"],
    "Công nghiệp": ["ngành công nghiệp", "sản xuất công nghiệp", "khu công nghiệp"],
    "Bảo hiểm": ["bảo hiểm nhân thọ", "bảo hiểm phi nhân thọ", "ngành bảo hiểm"],
    "Hàng không": ["hàng không", "sân bay", "hãng bay"],
    "Viễn thông": ["viễn thông", "nhà mạng"],
    "Dệt may": ["dệt may", "ngành may mặc", "xuất khẩu dệt may"],
    "Thủy sản": ["thủy sản", "xuất khẩu tôm cá", "nuôi trồng thủy sản"],
    "Xây dựng": ["ngành xây dựng", "nhà thầu xây dựng", "vật liệu xây dựng"],
    "Nông nghiệp": ["ngành nông nghiệp", "nông sản", "xuất khẩu gạo"],
}


def extract_stocks(text: str) -> List[str]:
    found = set()
    text_upper = text.upper()
    for symbol in STOCK_DICT:
        if re.search(r'\b' + re.escape(symbol) + r'\b', text_upper):
            found.add(symbol)
    text_lower = text.lower()
    for alias, symbol in COMPANY_TO_STOCK.items():
        if alias in text_lower:
            found.add(symbol)
    return list(found)


def extract_entities(text: str) -> Dict:
    stocks = extract_stocks(text)
    companies, industries = [], []
    for s in stocks:
        info = STOCK_DICT.get(s, {})
        if info.get("company"):
            companies.append(info["company"])
        if info.get("industry") and info["industry"] not in industries:
            industries.append(info["industry"])

    # Nhận diện ngành nghề theo từ khóa tổng quát, kể cả khi bài báo không
    # nhắc đến mã cổ phiếu/công ty cụ thể nào — để AI luôn tự bổ sung ngành
    # nghề liên quan thay vì bỏ trống.
    text_lower = text.lower()
    industry_matches: Dict[str, List[str]] = {}
    for industry, keywords in INDUSTRY_KEYWORDS.items():
        hits = [kw for kw in keywords if kw in text_lower]
        if hits:
            industry_matches[industry] = hits
            if industry not in industries:
                industries.append(industry)

    return {
        "stocks": stocks,
        "companies": companies,
        "industries": industries,
        "industry_evidence": industry_matches,
    }


def extract_events(text: str) -> List[str]:
    return list(extract_events_detailed(text).keys())


def extract_events_detailed(text: str) -> Dict[str, List[str]]:
    text_lower = text.lower()
    found: Dict[str, List[str]] = {}
    for event_type, keywords in EVENT_PATTERNS.items():
        hits = [kw for kw in keywords if kw in text_lower]
        if hits:
            found[event_type] = hits
    return found


def analyze_sentiment(text: str) -> Tuple[str, float]:
    sentiment, score, _pos, _neg = analyze_sentiment_detailed(text)
    return sentiment, score


def analyze_sentiment_detailed(text: str) -> Tuple[str, float, List[str], List[str]]:
    text_lower = text.lower()
    pos_hits = [kw for kw in POSITIVE_KEYWORDS if kw in text_lower]
    neg_hits = [kw for kw in NEGATIVE_KEYWORDS if kw in text_lower]
    pos, neg = len(pos_hits), len(neg_hits)
    total = pos + neg
    if total == 0:
        return "Neutral", 50.0, pos_hits, neg_hits
    ratio = pos / total
    if ratio >= 0.6:
        return "Positive", min(50 + (ratio - 0.5) * 100, 95), pos_hits, neg_hits
    if ratio <= 0.4:
        return "Negative", min(50 + (0.5 - ratio) * 100, 95), pos_hits, neg_hits
    return "Neutral", 50.0, pos_hits, neg_hits


def build_reasons(
    sentiment: str,
    pos_hits: List[str],
    neg_hits: List[str],
    events_detail: Dict[str, List[str]],
    industries: List[str],
    industry_evidence: Dict[str, List[str]],
    companies: List[str],
) -> List[str]:
    """Sinh ra danh sách lý do cụ thể, trích dẫn bằng chứng lấy trực tiếp từ
    nội dung bài báo, để người dùng biết AI kết luận dựa trên đâu chứ không
    phải suy đoán chung chung."""
    reasons: List[str] = []

    if pos_hits:
        reasons.append(
            f"Phát hiện {len(pos_hits)} từ khóa tích cực trong bài: "
            + ", ".join(f"'{k}'" for k in pos_hits[:5])
        )
    if neg_hits:
        reasons.append(
            f"Phát hiện {len(neg_hits)} từ khóa tiêu cực trong bài: "
            + ", ".join(f"'{k}'" for k in neg_hits[:5])
        )
    if not pos_hits and not neg_hits:
        reasons.append("Không tìm thấy từ khóa tích cực hay tiêu cực rõ ràng trong bài báo")

    for event_type, hits in events_detail.items():
        label = EVENT_LABELS_VI.get(event_type, event_type.replace("_", " ").title())
        reasons.append(
            f"Sự kiện '{label}' được nhận diện qua cụm từ: " + ", ".join(f"'{h}'" for h in hits[:3])
        )

    if companies:
        reasons.append("Bài báo đề cập trực tiếp đến: " + ", ".join(companies[:5]))

    for industry in industries:
        evidence = industry_evidence.get(industry)
        if evidence:
            reasons.append(
                f"Ngành '{industry}' được suy ra từ cụm từ trong bài: "
                + ", ".join(f"'{h}'" for h in evidence[:3])
            )
        else:
            reasons.append(f"Ngành '{industry}' được suy ra từ công ty/mã cổ phiếu được nhắc đến")

    sentiment_label = {"Positive": "TÍCH CỰC (có xu hướng hỗ trợ giá cổ phiếu tăng)",
                        "Negative": "TIÊU CỰC (có xu hướng gây áp lực giảm giá cổ phiếu)",
                        "Neutral": "TRUNG LẬP (chưa đủ tín hiệu rõ ràng để nghiêng hẳn về một chiều)"}
    reasons.append(f"=> Kết luận sentiment tổng thể của bài báo: {sentiment_label.get(sentiment, sentiment)}")

    return reasons


def analyze_article(title: str, content: Optional[str] = None) -> Dict:
    full_text = title + " " + (content or "")
    entities = extract_entities(full_text)
    events_detail = extract_events_detailed(full_text)
    sentiment, impact_score, pos_hits, neg_hits = analyze_sentiment_detailed(full_text)
    reasons = build_reasons(
        sentiment=sentiment,
        pos_hits=pos_hits,
        neg_hits=neg_hits,
        events_detail=events_detail,
        industries=entities["industries"],
        industry_evidence=entities["industry_evidence"],
        companies=entities["companies"],
    )
    return {
        "stocks": entities["stocks"],
        "companies": entities["companies"],
        "industries": entities["industries"],
        "events": list(events_detail.keys()),
        "sentiment": sentiment,
        "impact_score": round(impact_score, 2),
        "reasons": reasons,
    }
