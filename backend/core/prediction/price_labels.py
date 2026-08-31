"""Real price-based ground truth for the trend label, replacing the sentiment
proxy (SENTIMENT_TO_TREND) that train.py used before.

For each (symbol, published_date) the label compares the close price on the
first trading day at/after published_date (t0) against the close price
PRICE_HORIZON_DAYS trading sessions later (t0+N):

    pct_change >= +PRICE_MOVE_THRESHOLD  -> INCREASING
    pct_change <= -PRICE_MOVE_THRESHOLD  -> DECREASING
    otherwise                            -> UNCHANGED

Daily OHLC history is fetched once per symbol via vnstock and cached to CSV
(PRICE_CACHE_PATH) so re-running the labeling script does not re-hit the API.
"""
import os
import time
from typing import Dict, Optional, Tuple

import pandas as pd

PRICE_HORIZON_DAYS = 3
PRICE_MOVE_THRESHOLD = 2.0  # percent

TREND_LABELS = ["INCREASING", "DECREASING", "UNCHANGED"]

PRICE_CACHE_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "price_history_cache.csv")

_price_cache: Dict[str, pd.DataFrame] = {}


# vnstock's guest tier caps at 20 requests/minute and, on top of raising its
# own RateLimitExceeded, wraps it in a context manager that calls sys.exit()
# (vnai/beam/quota.py:CleanErrorContext.__exit__) - a BaseException, not an
# Exception, so a plain `except Exception` here would NOT catch it and the
# whole import script would die. Must catch BaseException explicitly.
_REQUEST_INTERVAL_SECONDS = 3.5  # ~17 req/min, safely under the 20/min guest cap
_RATE_LIMIT_BACKOFF_SECONDS = 45


def _fetch_symbol_history(symbol: str, start: str = "2018-06-01", end: str = "2023-06-01") -> Optional[pd.DataFrame]:
    from vnstock import Vnstock

    for attempt in range(2):
        try:
            df = Vnstock().stock(symbol=symbol, source="VCI").quote.history(start=start, end=end, interval="1D")
            break
        except BaseException as e:  # noqa: BLE001 - see module note above
            is_rate_limit = "rate limit" in str(e).lower() or isinstance(e, SystemExit)
            if is_rate_limit and attempt == 0:
                print(f"  rate limited on {symbol}, backing off {_RATE_LIMIT_BACKOFF_SECONDS}s...")
                time.sleep(_RATE_LIMIT_BACKOFF_SECONDS)
                continue
            print(f"  fetch failed for {symbol}: {e}")
            return None
    if df is None or df.empty:
        return None
    df = df[["time", "close"]].copy()
    df["time"] = pd.to_datetime(df["time"])
    df = df.sort_values("time").reset_index(drop=True)
    return df


def _read_cache() -> pd.DataFrame:
    if os.path.exists(PRICE_CACHE_PATH):
        return pd.read_csv(PRICE_CACHE_PATH, parse_dates=["time"])
    return pd.DataFrame(columns=["time", "close", "symbol"])


def _append_to_cache(symbol_df: pd.DataFrame) -> None:
    """Rewrites the cache file after each symbol so a crash mid-run (e.g. a
    rate limit that survives the retry) does not lose already-fetched data."""
    cached = _read_cache()
    combined = pd.concat([cached, symbol_df], ignore_index=True).drop_duplicates(subset=["symbol", "time"])
    os.makedirs(os.path.dirname(PRICE_CACHE_PATH), exist_ok=True)
    combined.to_csv(PRICE_CACHE_PATH, index=False)


def load_or_fetch_all(symbols: list) -> Dict[str, pd.DataFrame]:
    """Loads cached history from PRICE_CACHE_PATH, fetching only symbols that
    are missing from the cache. Safe to re-run: already-cached symbols are
    skipped, so an interrupted run just picks up where it left off."""
    cached = _read_cache()
    have = set(cached["symbol"].unique()) if not cached.empty else set()
    missing = [s for s in symbols if s not in have]
    print(f"{len(have & set(symbols))} symbols already cached, fetching {len(missing)} more")

    for i, symbol in enumerate(missing):
        df = _fetch_symbol_history(symbol)
        if df is not None and not df.empty:
            df = df.copy()
            df["symbol"] = symbol
            _append_to_cache(df)
            print(f"[{i + 1}/{len(missing)}] fetched {symbol}: {len(df)} rows")
        else:
            print(f"[{i + 1}/{len(missing)}] fetched {symbol}: NO DATA")
        time.sleep(_REQUEST_INTERVAL_SECONDS)

    combined = _read_cache()
    for symbol in symbols:
        sub = combined[combined["symbol"] == symbol].sort_values("time").reset_index(drop=True)
        if not sub.empty:
            _price_cache[symbol] = sub

    return _price_cache


def compute_actual_trend(symbol: str, published_date: str, horizon_days: int = PRICE_HORIZON_DAYS) -> Tuple[Optional[str], Optional[float]]:
    """Returns (trend_label, pct_change) or (None, None) if there isn't enough
    price history around published_date to compute a label."""
    df = _price_cache.get(symbol)
    if df is None or df.empty or not published_date:
        return None, None

    try:
        pub = pd.to_datetime(published_date)
    except (ValueError, TypeError):
        return None, None

    after = df[df["time"] >= pub]
    if after.empty:
        return None, None
    t0_idx = after.index[0]

    t1_idx = t0_idx + horizon_days
    if t1_idx >= len(df):
        return None, None

    close_t0 = df.loc[t0_idx, "close"]
    close_t1 = df.loc[t1_idx, "close"]
    if not close_t0 or close_t0 == 0:
        return None, None

    pct_change = round((close_t1 - close_t0) / close_t0 * 100, 3)
    if pct_change >= PRICE_MOVE_THRESHOLD:
        trend = "INCREASING"
    elif pct_change <= -PRICE_MOVE_THRESHOLD:
        trend = "DECREASING"
    else:
        trend = "UNCHANGED"
    return trend, pct_change
