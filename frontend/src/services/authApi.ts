import api from './api'
import type { AuthResponse, User } from '../types'

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),
  emailOtpRequest: (email: string) => api.post('/auth/email-otp/request', { email }),
  // fullName/dob/password chỉ có tác dụng khi email này CHƯA gắn tài khoản
  // nào (tức đang tạo mới) — backend bỏ qua nếu tài khoản đã tồn tại.
  emailOtpVerify: (email: string, code: string, fullName?: string, dateOfBirth?: string, password?: string) =>
    api.post<AuthResponse>('/auth/email-otp/verify', {
      email,
      code,
      full_name: fullName,
      date_of_birth: dateOfBirth,
      password,
    }),
  linkEmail: (email: string, code: string) => api.post<User>('/auth/link-email', { email, code }),
  me: () => api.get<User>('/auth/me'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, new_password: newPassword }),
  // avatarUrl: undefined = không đổi, '' = xoá avatar, chuỗi khác = data URI ảnh mới.
  updateProfile: (fullName: string, dateOfBirth?: string, avatarUrl?: string) =>
    api.patch<User>('/auth/me', {
      full_name: fullName,
      date_of_birth: dateOfBirth,
      avatar_url: avatarUrl,
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
}

export default authApi
