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
    return {"stocks": stocks, "companies": companies, "industries": industries}


def extract_events(text: str) -> List[str]:
    text_lower = text.lower()
    found = []
    for event_type, keywords in EVENT_PATTERNS.items():
        if any(kw in text_lower for kw in keywords):
            found.append(event_type)
    return found


def analyze_sentiment(text: str) -> Tuple[str, float]:
    text_lower = text.lower()
    pos = sum(1 for kw in POSITIVE_KEYWORDS if kw in text_lower)
    neg = sum(1 for kw in NEGATIVE_KEYWORDS if kw in text_lower)
    total = pos + neg
    if total == 0:
        return "Neutral", 50.0
    ratio = pos / total
    if ratio >= 0.6:
        return "Positive", min(50 + (ratio - 0.5) * 100, 95)
    elif ratio <= 0.4:
        return "Negative", min(50 + (0.5 - ratio) * 100, 95)
    return "Neutral", 50.0


def analyze_article(title: str, content: Optional[str] = None) -> Dict:
    full_text = title + " " + (content or "")
    entities = extract_entities(full_text)
    events = extract_events(full_text)
    sentiment, impact_score = analyze_sentiment(full_text)
    return {
        "stocks": entities["stocks"],
        "companies": entities["companies"],
        "industries": entities["industries"],
        "events": events,
        "sentiment": sentiment,
        "impact_score": round(impact_score, 2),
    }
