import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Activity, CalendarDays, ChevronDown, LogOut, Menu } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useLayout } from '../../context/LayoutContext'
import { useLanguage } from '../../context/LanguageContext'
import AnalysisIndicator from './AnalysisIndicator'

const PAGE_INFO_KEYS: Record<string, { title: string; breadcrumb: string }> = {
  '/dashboard': { title: 'topbar.page.dashboardTitle', breadcrumb: 'topbar.page.dashboardBreadcrumb' },
  '/feed': { title: 'topbar.page.feedTitle', breadcrumb: 'topbar.page.feedBreadcrumb' },
  '/stocks': { title: 'topbar.page.stocksTitle', breadcrumb: 'topbar.page.stocksBreadcrumb' },
  '/graph': { title: 'topbar.page.graphTitle', breadcrumb: 'topbar.page.graphBreadcrumb' },
  '/reports': { title: 'topbar.page.reportsTitle', breadcrumb: 'topbar.page.reportsBreadcrumb' },
  '/import': { title: 'topbar.page.importTitle', breadcrumb: 'topbar.page.importBreadcrumb' },
  '/settings': { title: 'topbar.page.settingsTitle', breadcrumb: 'topbar.page.settingsBreadcrumb' },
}

export default function Topbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { toggleSidebar } = useLayout()
  const { t, language } = useLanguage()
  const [menuOpen, setMenuOpen] = useState(false)
  const stockMatch = pathname.match(/^\/stocks\/([A-Za-z0-9]+)$/)
  const info = stockMatch
    ? {
        title: t('topbar.page.stockDetailTitle', { symbol: stockMatch[1].toUpperCase() }),
        breadcrumb: t('topbar.page.stockDetailBreadcrumb'),
      }
    : PAGE_INFO_KEYS[pathname]
      ? { title: t(PAGE_INFO_KEYS[pathname].title), breadcrumb: t(PAGE_INFO_KEYS[pathname].breadcrumb) }
      : { title: t('topbar.defaultTitle'), breadcrumb: '' }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const initial = (user?.full_name || user?.email || '?').charAt(0).toUpperCase()

  const now = new Date()
  const dateStr = now.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return (
    <header
      className="relative z-30 flex items-center justify-between px-6 h-[52px] flex-shrink-0"
      style={{
        background: 'var(--bg-card)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={toggleSidebar}
          aria-label={t('topbar.openMenu')}
          className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0"
          style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
        >
          <Menu size={16} />
        </button>
        <div className="min-w-0">
          <h2 className="font-sans font-semibold text-[14px] leading-tight" style={{ color: 'var(--text-primary)' }}>{info.title}</h2>
          <p className="text-[11px] leading-tight mt-0.5" style={{ color: 'var(--text-faint)' }}>
            {info.breadcrumb}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <AnalysisIndicator />

        <div className="hidden md:flex items-center gap-1.5" style={{ color: 'var(--text-faint)' }}>
          <CalendarDays size={12} />
          <span className="text-[11px]">{dateStr}</span>
        </div>

        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
          }}
        >
          <Activity size={11} className="text-emerald-500 pulse-dot" />
          <span className="text-[11px] text-emerald-600 font-medium">{t('topbar.live')}</span>
        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full transition-colors"
            style={{ border: '1px solid var(--border-subtle)' }}
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.full_name || user.email} className="w-6 h-6 rounded-full" />
            ) : (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%)' }}
              >
                {initial}
              </div>
            )}
            <span className="text-[12px] max-w-[110px] truncate" style={{ color: 'var(--text-secondary)' }}>
              {user?.full_name || user?.email}
            </span>
            <ChevronDown size={12} style={{ color: 'var(--text-faint)' }} />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-44 rounded-xl overflow-hidden z-50"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
            >
              <div className="px-3.5 py-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <p className="text-[12px] truncate" style={{ color: 'var(--text-primary)' }}>{user?.full_name || t('topbar.user')}</p>
                <p className="text-[11px] truncate" style={{ color: 'var(--text-faint)' }}>
                  {user?.email || user?.phone}
                </p>
              </div>
              <button
                onClick={() => { setMenuOpen(false); navigate('/settings') }}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[13px] hover:bg-black/5 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('topbar.settings')}
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[13px] hover:bg-black/5 transition-colors"
                style={{ color: '#dc2626' }}
              >
                <LogOut size={14} />
                {t('topbar.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
