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
    # NOTE: bare "lãi"/"lợi nhuận" are deliberately NOT here - they mean
    # "profit" with no direction, so counting them as positive false-triggers
    # on "lãi giảm"/"lợi nhuận giảm" (a real miss found against a genuine VN
    # profit-decline headline). Direction always comes from a tăng/giảm/cao
    # phrase pair below.
    "tăng", "tăng trưởng", "lợi nhuận tăng", "doanh thu tăng",
    "tích cực", "phục hồi", "hợp đồng mới", "ký kết", "mở rộng",
    "thành công", "vượt kế hoạch", "khởi sắc", "đột phá", "tăng mạnh",
    "tăng vọt", "tăng cao", "tăng kỷ lục", "lợi nhuận cao", "dẫn đầu",
    "đầu tư mới", "ra mắt", "hợp tác", "liên doanh", "xuất khẩu tăng",
    "thị phần tăng", "cổ tức", "chia cổ tức", "trúng thầu", "thắng thầu",
    "khả quan", "vượt dự báo", "vượt kỳ vọng", "lãi tăng", "lãi ròng tăng",
    "lợi nhuận ròng tăng", "lãi kỷ lục", "kết quả kinh doanh khả quan",
]

NEGATIVE_KEYWORDS = [
    "giảm", "lỗ", "sụt giảm", "tiêu cực", "vi phạm", "xử phạt",
    "rủi ro", "khó khăn", "thua lỗ", "âm", "nợ xấu", "giảm mạnh",
    "giảm sâu", "sụt", "yếu", "đình chỉ", "thu hồi", "phạt",
    "thanh tra", "điều tra", "cảnh báo", "mất thị phần",
    "hủy hợp đồng", "thu hẹp", "sa thải", "cắt giảm",
    "lãi giảm", "lợi nhuận giảm", "hạ dự báo", "hạ dự báo lợi nhuận",
    "giảm dự báo", "cắt giảm dự báo", "kém khả quan", "dưới kỳ vọng",
    "thấp hơn kỳ vọng",
]

EVENT_PATTERNS = {
    "profit_growth": [
        "lợi nhuận tăng", "lãi tăng", "doanh thu tăng", "lợi nhuận cao", "lãi kỷ lục",
        "lãi ròng tăng", "lợi nhuận ròng tăng", "vượt kế hoạch lợi nhuận", "lãi vượt",
    ],
    "profit_decline": [
        "lợi nhuận giảm", "lãi giảm", "doanh thu giảm", "thua lỗ", "lỗ",
        "hạ dự báo lợi nhuận", "hạ dự báo", "giảm dự báo lợi nhuận", "cắt giảm dự báo",
    ],
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


def extract_events(text: str, event_patterns: Optional[Dict[str, List[str]]] = None) -> List[str]:
    return list(extract_events_detailed(text, event_patterns).keys())


def extract_events_detailed(
    text: str, event_patterns: Optional[Dict[str, List[str]]] = None
) -> Dict[str, List[str]]:
    patterns = event_patterns if event_patterns is not None else EVENT_PATTERNS
    text_lower = text.lower()
    found: Dict[str, List[str]] = {}
    for event_type, keywords in patterns.items():
        hits = [kw for kw in keywords if kw in text_lower]
        if hits:
            found[event_type] = hits
    return found


# Matches an explicit reported swing like "tăng 33%" / "giảm mạnh 15,5%" -
# a quoted percentage is much stronger evidence of impact than the bare
# keyword, and VN financial headlines report one constantly ("lãi tăng 21%").
_MAGNITUDE_PATTERN = re.compile(r"(tăng|giảm)[^%\n]{0,20}?(\d{1,3}(?:[.,]\d+)?)\s*%")

# How many keyword hits count as "strong" evidence before the score is
# allowed to approach the 5/95 extremes. A single keyword match (e.g. one
# stray "yếu" in an otherwise neutral title) used to be enough to hit 95 -
# EVIDENCE_CAP makes the score climb gradually with corroborating evidence
# instead of saturating on the first hit.
_EVIDENCE_CAP = 5


def _extract_magnitude_hits(text_lower: str) -> List[Tuple[str, float]]:
    hits = []
    for m in _MAGNITUDE_PATTERN.finditer(text_lower):
        direction, raw_pct = m.group(1), m.group(2).replace(",", ".")
        try:
            hits.append((direction, float(raw_pct)))
        except ValueError:
            continue
    return hits


def analyze_sentiment(text: str) -> Tuple[str, float]:
    sentiment, score, _pos, _neg, _mag = analyze_sentiment_detailed(text)
    return sentiment, score


def analyze_sentiment_detailed(
    text: str, pos_threshold: float = 0.6, neg_threshold: float = 0.4
) -> Tuple[str, float, List[str], List[str], List[Tuple[str, float]]]:
    text_lower = text.lower()
    pos_hits = [kw for kw in POSITIVE_KEYWORDS if kw in text_lower]
    neg_hits = [kw for kw in NEGATIVE_KEYWORDS if kw in text_lower]
    magnitude_hits = _extract_magnitude_hits(text_lower)
    pos, neg = len(pos_hits), len(neg_hits)
    total = pos + neg
    if total == 0:
        return "Neutral", 50.0, pos_hits, neg_hits, magnitude_hits

    ratio = pos / total
    evidence_strength = min(total, _EVIDENCE_CAP) / _EVIDENCE_CAP

    if ratio >= pos_threshold:
        sentiment = "Positive"
        swing = (ratio - 0.5) * 100 * evidence_strength
    elif ratio <= neg_threshold:
        sentiment = "Negative"
        swing = -(0.5 - ratio) * 100 * evidence_strength
    else:
        return "Neutral", 50.0, pos_hits, neg_hits, magnitude_hits

    # An explicit reported percentage swing in the direction that matches the
    # keyword sentiment is direct quantified evidence, not just word choice -
    # it moves the score further than keyword count alone would.
    same_direction_magnitudes = [
        pct for direction, pct in magnitude_hits
        if (direction == "tăng") == (sentiment == "Positive")
    ]
    if same_direction_magnitudes:
        avg_magnitude = sum(same_direction_magnitudes) / len(same_direction_magnitudes)
        magnitude_boost = min(avg_magnitude, 40.0) / 40.0 * 20  # up to +-20
        swing += magnitude_boost if sentiment == "Positive" else -magnitude_boost

    score = max(5.0, min(50 + swing, 95.0))
    return sentiment, round(score, 2), pos_hits, neg_hits, magnitude_hits


def build_reasons(
    sentiment: str,
    pos_hits: List[str],
    neg_hits: List[str],
    events_detail: Dict[str, List[str]],
    industries: List[str],
    industry_evidence: Dict[str, List[str]],
    companies: List[str],
    magnitude_hits: Optional[List[Tuple[str, float]]] = None,
) -> List[str]:
    """Sinh ra danh sách lý do cụ thể, trích dẫn bằng chứng lấy trực tiếp từ
    nội dung bài báo, để người dùng biết AI kết luận dựa trên đâu chứ không
    phải suy đoán chung chung."""
    reasons: List[str] = []

    if magnitude_hits:
        quotes = ", ".join(f"{d} {p:g}%" for d, p in magnitude_hits[:5])
        reasons.append(f"Phát hiện số liệu định lượng trong bài (bằng chứng mạnh hơn từ khóa đơn thuần): {quotes}")

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


def analyze_article(title: str, content: Optional[str] = None, db=None) -> Dict:
    full_text = title + " " + (content or "")

    event_patterns = None
    pos_threshold, neg_threshold = 0.6, 0.4
    if db is not None:
        from app.core.settings_store import get_float_setting
        from app.services.keyword_service import get_active_event_patterns

        event_patterns = get_active_event_patterns(db)
        pos_threshold = get_float_setting(db, "sentiment_positive_threshold", 0.6)
        neg_threshold = get_float_setting(db, "sentiment_negative_threshold", 0.4)

    entities = extract_entities(full_text)
    events_detail = extract_events_detailed(full_text, event_patterns)
    sentiment, impact_score, pos_hits, neg_hits, magnitude_hits = analyze_sentiment_detailed(
        full_text, pos_threshold, neg_threshold
    )
    reasons = build_reasons(
        sentiment=sentiment,
        pos_hits=pos_hits,
        neg_hits=neg_hits,
        events_detail=events_detail,
        industries=entities["industries"],
        industry_evidence=entities["industry_evidence"],
        companies=entities["companies"],
        magnitude_hits=magnitude_hits,
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
