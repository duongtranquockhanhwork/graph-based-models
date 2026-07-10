import api from './api'
import type { AuthResponse, User } from '../types'

export const authApi = {
  register: (email: string, password: string, fullName?: string) =>
    api.post<AuthResponse>('/auth/register', { email, password, full_name: fullName }),
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),
  googleLogin: (idToken: string) =>
    api.post<AuthResponse>('/auth/google', { id_token: idToken }),
  me: () => api.get<User>('/auth/me'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, new_password: newPassword }),
  updateProfile: (fullName: string) => api.patch<User>('/auth/me', { full_name: fullName }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
}

export default authApi
