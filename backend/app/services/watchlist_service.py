from typing import List

from sqlalchemy.orm import Session

from app.models.watchlist import WatchlistItem
from app.services.live_price_service import symbol_exists
from app.services.nlp_service import STOCK_DICT


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

    # Mã nằm trong từ điển 257 mã của mô hình là mã thật, không cần hỏi bảng
    # giá. Nhập một CSV 22 bài từng gọi vnstock một lần cho mỗi mã và chạm hạn
    # mức 20 yêu cầu/phút ngay giữa lô.
    if symbol not in STOCK_DICT and not symbol_exists(symbol):
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
