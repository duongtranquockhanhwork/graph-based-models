import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { TOKEN_KEY } from '../services/api'
import { authApi } from '../services/authApi'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (email: string, password: string, fullName?: string) => Promise<User>
  loginWithGoogle: (idToken: string) => Promise<User>
  logout: () => void
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (token: string, newPassword: string) => Promise<void>
  updateProfile: (fullName: string) => Promise<User>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setIsLoading(false)
      return
    }
    authApi
      .me()
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setIsLoading(false))
  }, [])

  const applyAuth = (accessToken: string, authUser: User) => {
    localStorage.setItem(TOKEN_KEY, accessToken)
    setUser(authUser)
    return authUser
  }

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password)
    return applyAuth(res.data.access_token, res.data.user)
  }, [])

  const register = useCallback(async (email: string, password: string, fullName?: string) => {
    const res = await authApi.register(email, password, fullName)
    return applyAuth(res.data.access_token, res.data.user)
  }, [])

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const res = await authApi.googleLogin(idToken)
    return applyAuth(res.data.access_token, res.data.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  const forgotPassword = useCallback(async (email: string) => {
    await authApi.forgotPassword(email)
  }, [])

  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    await authApi.resetPassword(token, newPassword)
  }, [])

  const updateProfile = useCallback(async (fullName: string) => {
    const res = await authApi.updateProfile(fullName)
    setUser(res.data)
    return res.data
  }, [])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await authApi.changePassword(currentPassword, newPassword)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        loginWithGoogle,
        logout,
        forgotPassword,
        resetPassword,
        updateProfile,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
