import api from './api'

export const adminApi = {
  dashboard: () => api.get('/admin/dashboard'),

  users: {
    list: (q?: string) => api.get('/admin/users/', { params: q ? { q } : {} }),
    update: (id: number, data: { role?: string; is_active?: boolean }) =>
      api.patch(`/admin/users/${id}`, data),
  },

  settings: {
    list: () => api.get('/admin/settings/'),
    update: (key: string, value: string) => api.patch(`/admin/settings/${key}`, { value }),
  },

  keywords: {
    list: (event_type?: string) => api.get('/admin/event-keywords/', { params: event_type ? { event_type } : {} }),
    create: (data: { event_type: string; label_vi: string; keyword: string; is_active?: boolean }) =>
      api.post('/admin/event-keywords/', data),
    update: (id: number, data: object) => api.patch(`/admin/event-keywords/${id}`, data),
    delete: (id: number) => api.delete(`/admin/event-keywords/${id}`),
  },

  labeling: {
    queue: (skip = 0, limit = 50) => api.get('/admin/labeling/queue', { params: { skip, limit } }),
    submit: (newsId: number, data: { manual_sentiment?: string; manual_event_type?: string }) =>
      api.post(`/admin/labeling/${newsId}`, data),
  },

  validation: {
    dataQuality: () => api.get('/admin/data-validation'),
    results: () => api.get('/admin/validation-results'),
  },

  stocks: {
    list: () => api.get('/admin/stocks/'),
  },

  activity: {
    list: (skip = 0, limit = 50) => api.get('/admin/activity/', { params: { skip, limit } }),
  },
}

export default adminApi
