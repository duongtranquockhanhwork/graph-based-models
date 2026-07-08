import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

export const newsApi = {
  list: (skip = 0, limit = 50) => api.get('/news/', { params: { skip, limit } }),
  get: (id: number) => api.get(`/news/${id}`),
  create: (data: object) => api.post('/news/', data),
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
  get: (params?: { stock?: string; industry?: string; limit?: number }) =>
    api.get('/graph/', { params }),
  stats: () => api.get('/graph/stats'),
  stockFeatures: (symbol: string) => api.get(`/graph/stock/${symbol}/features`),
}

export const predictionApi = {
  list: () => api.get('/prediction/'),
  forStock: (symbol: string) => api.get(`/prediction/stock/${symbol}`),
  evaluate: () => api.get('/prediction/evaluate'),
}

export const analyticsApi = {
  dashboard: () => api.get('/analytics/dashboard'),
}

export default api
