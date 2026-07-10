from typing import List

from sqlalchemy.orm import Session

from app.models.watchlist import WatchlistItem
from app.services.live_price_service import symbol_exists


def list_symbols(db: Session, user_id: int) -> List[str]:
    items = (
        db.query(WatchlistItem)
        .filter(WatchlistItem.user_id == user_id)
        .order_by(WatchlistItem.created_at)
        .all()
    )
    return [i.symbol for i in items]


def add_symbol(db: Session, user_id: int, symbol: str) -> bool:
    symbol = (symbol or "").strip().upper()
    if not symbol:
        return False

    existing = (
        db.query(WatchlistItem)
        .filter(WatchlistItem.user_id == user_id, WatchlistItem.symbol == symbol)
        .first()
    )
    if existing:
        return True

    if not symbol_exists(symbol):
        return False

    db.add(WatchlistItem(user_id=user_id, symbol=symbol))
    db.commit()
    return True


def remove_symbol(db: Session, user_id: int, symbol: str) -> bool:
    symbol = (symbol or "").strip().upper()
    item = (
        db.query(WatchlistItem)
        .filter(WatchlistItem.user_id == user_id, WatchlistItem.symbol == symbol)
        .first()
    )
    if not item:
        return False
    db.delete(item)
    db.commit()
    return True
