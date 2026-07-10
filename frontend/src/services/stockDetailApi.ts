import api from './api'
import type { Candle, IntradayTrade, StockOverview, Shareholder, CompanyEvent, FinancialStatements } from '../types'

export const stockDetailApi = {
  history: (symbol: string, days = 180) =>
    api.get<Candle[]>(`/stock-detail/${symbol}/history`, { params: { days } }),
  intraday: (symbol: string, limit = 50) =>
    api.get<IntradayTrade[]>(`/stock-detail/${symbol}/intraday`, { params: { limit } }),
  overview: (symbol: string) => api.get<StockOverview | null>(`/stock-detail/${symbol}/overview`),
  shareholders: (symbol: string) => api.get<Shareholder[]>(`/stock-detail/${symbol}/shareholders`),
  events: (symbol: string) => api.get<CompanyEvent[]>(`/stock-detail/${symbol}/events`),
  financials: (symbol: string) => api.get<FinancialStatements>(`/stock-detail/${symbol}/financials`),
}

export default stockDetailApi
