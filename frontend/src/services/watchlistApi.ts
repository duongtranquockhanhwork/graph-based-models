import api from './api'
import type { LiveQuote } from '../types'

export const watchlistApi = {
  list: () => api.get<string[]>('/watchlist/'),
  add: (symbol: string) => api.post<string[]>('/watchlist/', { symbol }),
  remove: (symbol: string) => api.delete<string[]>(`/watchlist/${symbol}`),
  live: () => api.get<LiveQuote[]>('/watchlist/live'),
}

export default watchlistApi
