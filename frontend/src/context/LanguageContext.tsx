import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { translate, type Language } from '../i18n'
import { useAuth } from './AuthContext'

const LANG_KEY = 'finnexus_lang'

interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined)

function readStoredLanguage(): Language {
  const stored = localStorage.getItem(LANG_KEY)
  return stored === 'vi' ? 'vi' : 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user, updateLanguage: persistLanguage } = useAuth()
  const [language, setLanguageState] = useState<Language>(readStoredLanguage)

  // Tài khoản đăng nhập là nguồn sự thật: ngôn ngữ lưu trên server ghi đè
  // giá trị cục bộ ngay khi /me trả về (đăng nhập trên máy mới, hoặc đổi ở
  // thiết bị khác rồi quay lại đây).
  useEffect(() => {
    if (user?.language === 'en' || user?.language === 'vi') {
      setLanguageState(user.language)
      localStorage.setItem(LANG_KEY, user.language)
    }
  }, [user?.language])

  const setLanguage = useCallback(
    (next: Language) => {
      setLanguageState(next)
      localStorage.setItem(LANG_KEY, next)
      if (user) {
        persistLanguage(next).catch(() => {
          // Đổi giao diện ngay cả khi lưu lên server thất bại (mất mạng…) —
          // người dùng vẫn thấy hiệu ứng tức thì, lần đăng nhập sau mới lệch.
        })
      }
    },
    [user, persistLanguage]
  )

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(language, key, params),
    [language]
  )

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
