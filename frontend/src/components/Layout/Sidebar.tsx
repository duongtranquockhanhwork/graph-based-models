import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Newspaper,
  TrendingUp,
  CalendarClock,
  Smile,
  LineChart,
  GitBranch,
  FileBarChart,
  Radio,
  Settings,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
  { to: '/news', icon: Newspaper, label: 'Tin tức' },
  { to: '/stocks', icon: TrendingUp, label: 'Cổ phiếu' },
  { to: '/events', icon: CalendarClock, label: 'Sự kiện tài chính' },
  { to: '/sentiment', icon: Smile, label: 'Phân tích cảm xúc' },
  { to: '/prediction', icon: LineChart, label: 'Dự đoán xu hướng' },
  { to: '/live', icon: Radio, label: 'Bảng giá Live' },
  { to: '/reports', icon: FileBarChart, label: 'Báo cáo' },
  { to: '/settings', icon: Settings, label: 'Cài đặt' },
]

export default function Sidebar() {
  const { user } = useAuth()
  const initial = (user?.full_name || user?.email || '?').charAt(0).toUpperCase()

  return (
    <aside
      className="w-60 flex flex-col flex-shrink-0"
      style={{
        background: 'linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-base) 100%)',
        borderRight: '1px solid var(--border-subtle)',
      }}
    >
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%)',
              boxShadow: '0 0 20px rgba(37,99,235,0.35), 0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            <GitBranch size={17} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-[15px] leading-tight gradient-text">FinNexus KG</h1>
            <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-faint)' }}>
              VN Stock Knowledge Graph
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <p
          className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--text-faint)' }}
        >
          Điều hướng
        </p>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group relative"
            style={({ isActive }) =>
              isActive
                ? {
                    background: 'linear-gradient(135deg, rgba(37,99,235,0.16) 0%, rgba(14,165,233,0.08) 100%)',
                    borderLeft: '3px solid #3b82f6',
                    paddingLeft: '9px',
                    color: 'var(--text-primary)',
                  }
                : { color: 'var(--text-secondary)', borderLeft: '3px solid transparent', paddingLeft: '9px' }
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={15}
                  className="flex-shrink-0 transition-colors"
                  style={{ color: isActive ? '#3b82f6' : 'var(--text-muted)' }}
                />
                <span className="flex-1 text-[13px]">{label}</span>
                {isActive && (
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: '#3b82f6', boxShadow: '0 0 6px #3b82f6' }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Profile */}
      <NavLink
        to="/settings"
        className="block px-4 py-3 transition-colors hover:bg-black/5"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2.5">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={user.full_name || user.email} className="w-8 h-8 rounded-full flex-shrink-0" />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%)' }}
            >
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[12px] truncate" style={{ color: 'var(--text-primary)' }}>
              {user?.full_name || user?.email}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>Nhà đầu tư</p>
          </div>
        </div>
      </NavLink>
    </aside>
  )
}
