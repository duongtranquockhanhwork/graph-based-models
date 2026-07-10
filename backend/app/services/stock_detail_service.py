import math
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import pandas as pd

HISTORY_TTL_SECONDS = 300
INTRADAY_TTL_SECONDS = 5
COMPANY_TTL_SECONDS = 3600

_cache: Dict[str, Dict] = {}


def _cached(key: str, ttl: int, loader):
    now = time.time()
    entry = _cache.get(key)
    if entry and now - entry["fetched_at"] < ttl:
        return entry["data"]
    data = loader()
    _cache[key] = {"data": data, "fetched_at": now}
    return data


def _clean(value):
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()
    return value


def _records(df: pd.DataFrame) -> List[Dict]:
    if df is None or df.empty:
        return []
    records = df.to_dict("records")
    return [{k: _clean(v) for k, v in row.items()} for row in records]


def get_history(symbol: str, days: int = 180) -> List[Dict]:
    symbol = symbol.upper()

    def loader():
        try:
            from vnstock import Quote

            end = datetime.now(timezone.utc)
            start = end - timedelta(days=days)
            q = Quote(symbol=symbol, source="VCI")
            df = q.history(start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"), interval="1D")
            if df is None or df.empty:
                return []
            df = df.copy()
            for col in ("open", "high", "low", "close"):
                df[col] = df[col] * 1000
            df["time"] = df["time"].astype(str)
            return _records(df)
        except Exception:
            return []

    return _cached(f"history:{symbol}:{days}", HISTORY_TTL_SECONDS, loader)


def get_intraday_trades(symbol: str, limit: int = 50) -> List[Dict]:
    symbol = symbol.upper()

    def loader():
        try:
            from vnstock import Quote

            q = Quote(symbol=symbol, source="kbs")
            df = q.intraday()
            if df is None or df.empty:
                return []
            df = df.copy()
            df["time"] = df["time"].astype(str)
            df["price"] = df["price"] * 1000
            return _records(df.head(limit))
        except Exception:
            return []

    return _cached(f"intraday:{symbol}", INTRADAY_TTL_SECONDS, loader)


def get_overview(symbol: str) -> Optional[Dict]:
    symbol = symbol.upper()

    def loader():
        try:
            from vnstock import Company

            c = Company(symbol=symbol, source="VCI")
            df = c.overview()
            records = _records(df)
            return records[0] if records else None
        except Exception:
            return None

    return _cached(f"overview:{symbol}", COMPANY_TTL_SECONDS, loader)


def get_shareholders(symbol: str) -> List[Dict]:
    symbol = symbol.upper()

    def loader():
        try:
            from vnstock import Company

            c = Company(symbol=symbol, source="VCI")
            return _records(c.shareholders())
        except Exception:
            return []

    return _cached(f"shareholders:{symbol}", COMPANY_TTL_SECONDS, loader)


def get_events(symbol: str) -> List[Dict]:
    symbol = symbol.upper()

    def loader():
        try:
            from vnstock import Company

            c = Company(symbol=symbol, source="VCI")
            return _records(c.events())
        except Exception:
            return []

    return _cached(f"events:{symbol}", COMPANY_TTL_SECONDS, loader)


def get_financials(symbol: str) -> Dict[str, List[Dict]]:
    symbol = symbol.upper()

    def loader():
        from vnstock import Finance

        f = Finance(symbol=symbol, source="VCI")
        result = {"income_statement": [], "balance_sheet": [], "cash_flow": [], "available": False}
        try:
            result["income_statement"] = _records(f.income_statement(period="year", lang="vi"))
        except Exception:
            pass
        try:
            result["balance_sheet"] = _records(f.balance_sheet(period="year", lang="vi"))
        except Exception:
            pass
        try:
            result["cash_flow"] = _records(f.cash_flow(period="year", lang="vi"))
        except Exception:
            pass
        result["available"] = bool(result["income_statement"] or result["balance_sheet"] or result["cash_flow"])
        return result

    return _cached(f"financials:{symbol}", COMPANY_TTL_SECONDS, loader)
