import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const { language } = useLanguage()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="relative inline-flex items-center h-8 w-16 rounded-full transition-colors flex-shrink-0"
      style={{ background: isDark ? '#1e3556' : '#cbd5e1' }}
      aria-label={language === 'vi' ? 'Chuyển giao diện sáng/tối' : 'Toggle light/dark theme'}
    >
      <span
        className="absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center transition-transform"
        style={{
          transform: isDark ? 'translateX(32px)' : 'translateX(0)',
          background: isDark ? '#0d1f35' : '#ffffff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        }}
      >
        {isDark ? <Moon size={13} className="text-blue-300" /> : <Sun size={13} className="text-amber-500" />}
      </span>
    </button>
  )
}
