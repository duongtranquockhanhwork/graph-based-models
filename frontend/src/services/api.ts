import axios from 'axios'

export const TOKEN_KEY = 'finnexus_token'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export interface NewsFilters {
  skip?: number
  limit?: number
  q?: string
  source?: string
  sentiment?: string
  event_type?: string
  stock?: string
  date_from?: string
  date_to?: string
}

export const newsApi = {
  list: (filters: NewsFilters = {}) => api.get('/news/', { params: { skip: 0, limit: 50, ...filters } }),
  get: (id: number) => api.get(`/news/${id}`),
  create: (data: object) => api.post('/news/', data),
  patch: (id: number, data: object) => api.patch(`/news/${id}`, data),
  uploadCsv: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/news/upload-csv', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  importUrl: (url: string) => api.post('/news/import-url', { url }),
  analyze: (id: number) => api.post(`/news/${id}/analyze`),
  /** Claude giải thích bài báo. Có bản còn hiệu lực thì trả ngay, không gọi lại.
   *  Timeout riêng vì một lần tạo mới có thể mất tới một phút. */
  aiAnalysis: (id: number) => api.post(`/news/${id}/ai-analysis`, undefined, { timeout: 150_000 }),
  aiAnalysisStatus: () => api.get<{ configured: boolean; model: string }>('/news/ai-analysis/status'),
  /** Tiến trình phân tích nền của một lô bài vừa nhập. */
  analysisStatus: (ids: number[]) =>
    api.post<{
      total: number
      analyzed: number
      pending: number
      done: boolean
      scored?: number
      refused?: number
      needs_review?: number
      symbols?: string[]
    }>('/news/analysis-status', { ids }),
  analyzeAll: () => api.post('/news/analyze-all'),
  delete: (id: number) => api.delete(`/news/${id}`),
}

export interface GraphFilters {
  stock?: string
  industry?: string
  limit?: number
}

export const graphApi = {
  data: (filters: GraphFilters = {}) => api.get('/graph/', { params: filters }),
  stats: () => api.get('/graph/stats'),
  stockFeatures: (symbol: string) => api.get(`/graph/stock/${symbol}/features`),
}

export interface ScorePayload {
  title: string
  content?: string
  published_date?: string
  url?: string
  source?: string
}

export const predictionApi = {
  list: () => api.get('/prediction/'),
  forStock: (symbol: string) => api.get(`/prediction/stock/${symbol}`),
  evaluate: () => api.get('/prediction/evaluate'),
  modelInfo: () => api.get('/prediction/model-info'),
  /** Chấm thử một bài mà không lưu. Trả cả trạng thái TỪ CHỐI của mô hình. */
  score: (payload: ScorePayload) => api.post('/prediction/score', payload),
}

export const analyticsApi = {
  dashboard: () => api.get('/analytics/dashboard'),
  stocks: () => api.get('/analytics/stocks'),
}

export default api
