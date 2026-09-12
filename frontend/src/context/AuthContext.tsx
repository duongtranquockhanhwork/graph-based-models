import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { TOKEN_KEY } from '../services/api'
import { authApi } from '../services/authApi'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<User>
  // fullName/dob/password chỉ áp dụng khi email này đang tạo tài khoản mới.
  registerWithEmail: (
    email: string,
    code: string,
    fullName?: string,
    dateOfBirth?: string,
    password?: string
  ) => Promise<User>
  linkEmail: (email: string, code: string) => Promise<User>
  logout: () => void
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (token: string, newPassword: string) => Promise<void>
  updateProfile: (fullName: string) => Promise<User>
  completeProfile: (fullName: string, dateOfBirth: string) => Promise<User>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  refreshUser: () => Promise<User | null>
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

  const registerWithEmail = useCallback(
    async (email: string, code: string, fullName?: string, dateOfBirth?: string, password?: string) => {
      const res = await authApi.emailOtpVerify(email, code, fullName, dateOfBirth, password)
      return applyAuth(res.data.access_token, res.data.user)
    },
    []
  )

  const linkEmail = useCallback(async (email: string, code: string) => {
    const res = await authApi.linkEmail(email, code)
    setUser(res.data)
    return res.data
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

  const completeProfile = useCallback(async (fullName: string, dateOfBirth: string) => {
    const res = await authApi.updateProfile(fullName, dateOfBirth)
    setUser(res.data)
    return res.data
  }, [])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await authApi.changePassword(currentPassword, newPassword)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.me()
      setUser(res.data)
      return res.data
    } catch {
      return null
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        registerWithEmail,
        linkEmail,
        logout,
        forgotPassword,
        resetPassword,
        updateProfile,
        completeProfile,
        changePassword,
        refreshUser,
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
