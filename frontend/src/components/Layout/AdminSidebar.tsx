import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Newspaper,
  PenLine,
  Settings,
  ShieldCheck,
  Sliders,
  TrendingUp,
  Users,
} from 'lucide-react'
import BrandMark from '../common/BrandMark'
import { useAuth } from '../../context/AuthContext'
import { useLayout } from '../../context/LayoutContext'

/** Điều hướng quản trị, gom theo việc admin thực sự làm.
 *
 * Bản trước có 10 mục phẳng, trong đó:
 *  - "Kiểm định dữ liệu" và "Kết quả kiểm định" cùng đọc validation_service và
 *    cùng trả lời một câu hỏi; nội dung của cả hai đã có sẵn trên Dashboard.
 *  - "Cấu hình hệ thống" và "Quản lý từ khoá sự kiện" cùng thay đổi cách phân
 *    tích diễn giải bài báo.
 *  - "Quản lý cổ phiếu" là bảng chỉ-đọc từ cùng service với trang Cổ phiếu,
 *    không có thao tác quản trị nào, và kém hơn trang Bảng giá đã có.
 * 9/10 trang không có một liên kết đi tiếp nào.
 */
const groups: { title: string; links: { to: string; icon: typeof LayoutDashboard; label: string }[] }[] = [
  {
    title: 'Vận hành',
    links: [
      { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
      { to: '/admin/news', icon: Newspaper, label: 'Dữ liệu tin tức' },
      { to: '/admin/labeling', icon: PenLine, label: 'Tự đọc và xác nhận' },
    ],
  },
  {
    title: 'Chất lượng',
    links: [
      { to: '/admin/quality', icon: ShieldCheck, label: 'Chất lượng dữ liệu' },
      { to: '/admin/tuning', icon: Sliders, label: 'Cách đọc hiểu bài' },
    ],
  },
  {
    title: 'Hệ thống',
    links: [
      { to: '/admin/users', icon: Users, label: 'Người dùng' },
      { to: '/admin/live', icon: TrendingUp, label: 'Cổ phiếu' },
      { to: '/admin/profile', icon: Settings, label: 'Hồ sơ của tôi' },
    ],
  },
]


export default function AdminSidebar() {
  const { user } = useAuth()
  const { sidebarOpen, closeSidebar } = useLayout()
  const initial = (user?.full_name || user?.email || '?').charAt(0).toUpperCase()

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(15,23,42,0.45)' }}
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}
    <aside
      className={`w-64 flex flex-col flex-shrink-0 fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
      aria-label="Điều hướng quản trị"
      style={{
        background: 'linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-base) 100%)',
        borderRight: '2px solid #10b981',
        boxShadow: '4px 0 24px rgba(16,185,129,0.08)',
      }}
    >
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 rounded-md">
            <BrandMark size={36} tone="admin" />
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
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.title} className="mb-3">
            <p
              className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-faint)' }}
            >
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.links.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={closeSidebar}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-200 relative"
                  style={({ isActive }) =>
                    isActive
                      ? {
                          background: 'rgba(16,185,129,0.1)',
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
                          style={{ background: '#10b981' }}
                        />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Profile footer */}
      <NavLink
        to="/admin/profile"
        onClick={closeSidebar}
        className="block px-4 py-3 transition-colors hover:bg-black/5"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2.5">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={user.full_name || user.email} className="w-8 h-8 rounded-full flex-shrink-0" />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold text-white flex-shrink-0"
              style={{ background: '#047857' }}
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
    </>
  )
}
