from fastapi import APIRouter, HTTPException

from app.services import price_band_service, stock_detail_service

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


@router.get("/{symbol}/price-band")
def price_band(symbol: str):
    """Vùng giá tham khảo tính từ giá lịch sử thật — không phải dự đoán. Xem
    docstring price_band_service.compute_price_band. 404 khi không đủ dữ liệu
    (thay vì trả về một vùng giá tính trên quá ít phiên, dễ gây hiểu lầm)."""
    band = price_band_service.compute_price_band(symbol)
    if band is None:
        raise HTTPException(404, "Chưa đủ dữ liệu giá lịch sử để tính vùng giá cho mã này")
    return band
