import math
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional

import pandas as pd

LIVE_QUOTE_TTL_SECONDS = 10

_cache: Dict[str, Dict] = {}


def _num(value) -> float:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _row_to_quote(row: pd.Series) -> Optional[Dict]:
    symbol = row.get(("listing", "symbol"))
    if symbol is None or (isinstance(symbol, float) and math.isnan(symbol)):
        return None

    reference_price = _num(row.get(("match", "reference_price")) or row.get(("listing", "ref_price")))
    price = _num(row.get(("match", "match_price")))
    if price == 0:
        price = reference_price

    change = round(price - reference_price, 2) if reference_price else 0.0
    percent_change = round((change / reference_price) * 100, 2) if reference_price else 0.0

    return {
        "symbol": str(symbol).upper(),
        "company_name": row.get(("listing", "organ_name")) or None,
        "exchange": row.get(("listing", "exchange")) or None,
        "price": price,
        "reference_price": reference_price,
        "ceiling": _num(row.get(("listing", "ceiling"))),
        "floor": _num(row.get(("listing", "floor"))),
        "open_price": _num(row.get(("match", "open_price"))),
        "avg_price": _num(row.get(("match", "avg_match_price"))),
        "highest": _num(row.get(("match", "highest"))),
        "lowest": _num(row.get(("match", "lowest"))),
        "volume": int(_num(row.get(("match", "accumulated_volume")))),
        "change": change,
        "percent_change": percent_change,
        "bid_1_price": _num(row.get(("bid_ask", "bid_1_price"))),
        "bid_1_volume": int(_num(row.get(("bid_ask", "bid_1_volume")))),
        "bid_2_price": _num(row.get(("bid_ask", "bid_2_price"))),
        "bid_2_volume": int(_num(row.get(("bid_ask", "bid_2_volume")))),
        "bid_3_price": _num(row.get(("bid_ask", "bid_3_price"))),
        "bid_3_volume": int(_num(row.get(("bid_ask", "bid_3_volume")))),
        "ask_1_price": _num(row.get(("bid_ask", "ask_1_price"))),
        "ask_1_volume": int(_num(row.get(("bid_ask", "ask_1_volume")))),
        "ask_2_price": _num(row.get(("bid_ask", "ask_2_price"))),
        "ask_2_volume": int(_num(row.get(("bid_ask", "ask_2_volume")))),
        "ask_3_price": _num(row.get(("bid_ask", "ask_3_price"))),
        "ask_3_volume": int(_num(row.get(("bid_ask", "ask_3_volume")))),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def _fetch_quotes(symbols: List[str]) -> Dict[str, Dict]:
    from vnstock import Trading

    try:
        trading = Trading(source="VCI")
        board = trading.price_board(symbols_list=symbols)
    except SystemExit as exc:
        # vnstock gọi sys.exit khi vượt hạn mức gọi API. Trong web server, điều
        # đó sẽ làm sập cả tiến trình; đổi thành lỗi thường của riêng request này.
        raise RuntimeError(f"vnstock quota: {exc}") from None

    result: Dict[str, Dict] = {}
    if ("listing", "symbol") not in board.columns:
        return result
    for _, row in board.iterrows():
        quote = _row_to_quote(row)
        if quote:
            result[quote["symbol"]] = quote
    return result


def get_live_quotes(symbols: List[str]) -> Dict[str, Dict]:
    symbols = [s.upper() for s in symbols]
    now = time.time()
    stale = [s for s in symbols if s not in _cache or now - _cache[s]["fetched_at"] > LIVE_QUOTE_TTL_SECONDS]

    if stale:
        fresh = _fetch_quotes(stale)
        for symbol in stale:
            if symbol in fresh:
                _cache[symbol] = {"data": fresh[symbol], "fetched_at": now}

    return {s: _cache[s]["data"] for s in symbols if s in _cache}


def symbol_exists(symbol: str) -> bool:
    quotes = get_live_quotes([symbol.upper()])
    return symbol.upper() in quotes
