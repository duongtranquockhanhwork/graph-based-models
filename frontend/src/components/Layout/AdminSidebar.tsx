import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Newspaper,
  TrendingUp,
  Tags,
  ShieldCheck,
  PenLine,
  Gauge,
  Users,
  Settings,
  ShieldHalf,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const links = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/news', icon: Newspaper, label: 'Quản lý tin tức' },
  { to: '/admin/stocks', icon: TrendingUp, label: 'Quản lý cổ phiếu' },
  { to: '/admin/keywords', icon: Tags, label: 'Quản lý từ khoá sự kiện' },
  { to: '/admin/data-validation', icon: ShieldCheck, label: 'Kiểm định dữ liệu' },
  { to: '/admin/labeling', icon: PenLine, label: 'Gán nhãn thủ công' },
  { to: '/admin/validation-results', icon: Gauge, label: 'Kết quả kiểm định' },
  { to: '/admin/users', icon: Users, label: 'Quản lý người dùng' },
  { to: '/admin/settings', icon: Settings, label: 'Cấu hình hệ thống' },
]

export default function AdminSidebar() {
  const { user } = useAuth()
  const initial = (user?.full_name || user?.email || '?').charAt(0).toUpperCase()

  return (
    <aside
      className="w-64 flex flex-col flex-shrink-0"
      style={{
        background: 'linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-base) 100%)',
        borderRight: '2px solid #10b981',
        boxShadow: '4px 0 24px rgba(16,185,129,0.08)',
      }}
    >
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #047857 0%, #10b981 100%)',
              boxShadow: '0 0 20px rgba(16,185,129,0.4), 0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            <ShieldHalf size={17} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-[15px] leading-tight" style={{ color: 'var(--text-primary)' }}>
              FinNexus KG
            </h1>
            <p className="text-[10px] mt-0.5 truncate" style={{ color: '#10b981' }}>
              Admin Console
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
          Quản trị hệ thống
        </p>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group relative"
            style={({ isActive }) =>
              isActive
                ? {
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(5,150,105,0.08) 100%)',
                    borderLeft: '3px solid #10b981',
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
                  style={{ color: isActive ? '#10b981' : 'var(--text-muted)' }}
                />
                <span className="flex-1 text-[13px]">{label}</span>
                {isActive && (
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: '#10b981', boxShadow: '0 0 6px #10b981' }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Profile footer */}
      <NavLink
        to="/admin/profile"
        className="block px-4 py-3 transition-colors hover:bg-black/5"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2.5">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={user.full_name || user.email} className="w-8 h-8 rounded-full flex-shrink-0" />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #047857 0%, #10b981 100%)' }}
            >
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[12px] truncate" style={{ color: 'var(--text-primary)' }}>
              {user?.full_name || user?.email}
            </p>
            <p className="text-[10px]" style={{ color: '#10b981' }}>Quản trị viên</p>
          </div>
        </div>
      </NavLink>
    </aside>
  )
}
