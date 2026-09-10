import { NavLink } from 'react-router-dom'
import {
  FileBarChart,
  LayoutDashboard,
  Network,
  Newspaper,
  Settings,
  TrendingUp,
  Upload,
} from 'lucide-react'
import BrandMark from '../common/BrandMark'
import { useAuth } from '../../context/AuthContext'
import { useLayout } from '../../context/LayoutContext'

/** Điều hướng gom theo câu hỏi người dùng đang hỏi, không theo bảng dữ liệu.
 *
 * Bản trước có 11 mục phẳng, trong đó ba mục (Tin tức / Sự kiện tài chính /
 * Phân tích cảm xúc) đọc cùng một bảng và chỉ khác bộ lọc, còn Cổ phiếu và
 * Bảng giá Live cùng liệt kê mã. Người dùng phải tự ghép chúng lại trong đầu.
 */
const groups: { title: string; links: { to: string; icon: typeof LayoutDashboard; label: string }[] }[] = [
  {
    title: 'Theo dõi',
    links: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
      { to: '/feed', icon: Newspaper, label: 'Dòng tin' },
      { to: '/stocks', icon: TrendingUp, label: 'Cổ phiếu' },
    ],
  },
  {
    title: 'Khám phá',
    links: [
      { to: '/graph', icon: Network, label: 'Knowledge Graph' },
      { to: '/reports', icon: FileBarChart, label: 'Độ chính xác' },
    ],
  },
  {
    title: 'Dữ liệu',
    links: [
      { to: '/import', icon: Upload, label: 'Nhập dữ liệu' },
      { to: '/settings', icon: Settings, label: 'Cài đặt' },
    ],
  },
]


export default function Sidebar() {
  const { user } = useAuth()
  const { sidebarOpen, closeSidebar } = useLayout()
  const initial = (user?.full_name || user?.email || '?').charAt(0).toUpperCase()

  return (
    <>
      {/* Lớp phủ chỉ tồn tại ở khổ hẹp, nơi sidebar trượt đè lên nội dung. */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(15,23,42,0.45)' }}
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={`w-60 flex flex-col flex-shrink-0 fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: 'linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-base) 100%)',
          borderRight: '1px solid var(--border-subtle)',
        }}
        aria-label="Điều hướng chính"
      >
        {/* Logo */}
        <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 rounded-md">
              <BrandMark size={36} />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-[15px] leading-tight gradient-text">FinNexus KG</h1>
              <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-faint)' }}>
                VN Stock Knowledge Graph
              </p>
            </div>
          </div>
        </div>

        {/* Điều hướng */}
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
                            background: 'rgba(37,99,235,0.1)',
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
                            style={{ background: '#3b82f6' }}
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

        {/* Hồ sơ */}
        <NavLink
          to="/settings"
          onClick={closeSidebar}
          className="block px-4 py-3 transition-colors hover:bg-black/5"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2.5">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="w-8 h-8 rounded-full flex-shrink-0"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold text-white flex-shrink-0"
                style={{ background: '#1d4ed8' }}
              >
                {initial}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[12px] truncate" style={{ color: 'var(--text-primary)' }}>
                {user?.full_name || user?.email}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                Nhà đầu tư
              </p>
            </div>
          </div>
        </NavLink>
      </aside>
    </>
  )
}
