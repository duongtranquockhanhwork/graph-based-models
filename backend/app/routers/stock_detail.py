from fastapi import APIRouter

from app.services import stock_detail_service

router = APIRouter()


@router.get("/{symbol}/history")
def history(symbol: str, days: int = 180):
    return stock_detail_service.get_history(symbol, days)


@router.get("/{symbol}/intraday")
def intraday(symbol: str, limit: int = 50):
    return stock_detail_service.get_intraday_trades(symbol, limit)


@router.get("/{symbol}/overview")
def overview(symbol: str):
    return stock_detail_service.get_overview(symbol)


@router.get("/{symbol}/shareholders")
def shareholders(symbol: str):
    return stock_detail_service.get_shareholders(symbol)


@router.get("/{symbol}/events")
def events(symbol: str):
    return stock_detail_service.get_events(symbol)


@router.get("/{symbol}/financials")
def financials(symbol: str):
    return stock_detail_service.get_financials(symbol)
