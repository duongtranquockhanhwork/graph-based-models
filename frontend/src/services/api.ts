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
  analyzeAll: () => api.post('/news/analyze-all'),
  delete: (id: number) => api.delete(`/news/${id}`),
}

export const graphApi = {
  stockFeatures: (symbol: string) => api.get(`/graph/stock/${symbol}/features`),
}

export const predictionApi = {
  list: () => api.get('/prediction/'),
  forStock: (symbol: string) => api.get(`/prediction/stock/${symbol}`),
  evaluate: () => api.get('/prediction/evaluate'),
  modelInfo: () => api.get('/prediction/model-info'),
}

export const analyticsApi = {
  dashboard: () => api.get('/analytics/dashboard'),
  stocks: () => api.get('/analytics/stocks'),
}

export default api
