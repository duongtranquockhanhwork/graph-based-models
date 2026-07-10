from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services import watchlist_service
from app.services.live_price_service import get_live_quotes

router = APIRouter()


class WatchlistAddRequest(BaseModel):
    symbol: str


@router.get("/")
def list_watchlist(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return watchlist_service.list_symbols(db, current_user.id)


@router.post("/")
def add_watchlist_item(
    payload: WatchlistAddRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    symbol = payload.symbol.strip().upper()
    if not symbol:
        raise HTTPException(400, "Mã cổ phiếu không được để trống")

    ok = watchlist_service.add_symbol(db, current_user.id, symbol)
    if not ok:
        raise HTTPException(400, f"Không tìm thấy mã cổ phiếu '{symbol}' trên thị trường")

    return watchlist_service.list_symbols(db, current_user.id)


@router.delete("/{symbol}")
def remove_watchlist_item(
    symbol: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ok = watchlist_service.remove_symbol(db, current_user.id, symbol)
    if not ok:
        raise HTTPException(404, "Mã cổ phiếu không có trong watchlist")
    return watchlist_service.list_symbols(db, current_user.id)


@router.get("/live")
def live_watchlist(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    symbols = watchlist_service.list_symbols(db, current_user.id)
    if not symbols:
        return []
    quotes = get_live_quotes(symbols)
    return [quotes[s] for s in symbols if s in quotes]
