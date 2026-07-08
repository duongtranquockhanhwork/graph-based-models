import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Upload,
  FileSearch,
  GitBranch,
  TrendingUp,
  BarChart3,
} from 'lucide-react'

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
  { to: '/import', icon: Upload, label: 'Nhập dữ liệu' },
  { to: '/analysis', icon: FileSearch, label: 'Phân tích NLP' },
  { to: '/graph', icon: GitBranch, label: 'Knowledge Graph' },
  { to: '/prediction', icon: TrendingUp, label: 'Dự đoán xu hướng' },
  { to: '/evaluation', icon: BarChart3, label: 'Đánh giá mô hình' },
]

export default function Sidebar() {
  return (
    <aside
      className="w-60 flex flex-col flex-shrink-0"
      style={{
        background: 'linear-gradient(180deg, #07111f 0%, #050c1a 100%)',
        borderRight: '1px solid #1a2d4a',
      }}
    >
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid #1a2d4a' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%)',
              boxShadow: '0 0 20px rgba(37,99,235,0.45), 0 2px 8px rgba(0,0,0,0.4)',
            }}
          >
            <GitBranch size={17} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-[15px] leading-tight gradient-text">FinNexus KG</h1>
            <p className="text-[10px] mt-0.5 truncate" style={{ color: '#3d5a7a' }}>
              VN Stock Knowledge Graph
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <p
          className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: '#2a4a6a' }}
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
                    background: 'linear-gradient(135deg, rgba(37,99,235,0.22) 0%, rgba(14,165,233,0.1) 100%)',
                    borderLeft: '3px solid #3b82f6',
                    paddingLeft: '9px',
                    color: '#e2e8f0',
                  }
                : { color: '#475569', borderLeft: '3px solid transparent', paddingLeft: '9px' }
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={15}
                  className="flex-shrink-0 transition-colors"
                  style={{ color: isActive ? '#60a5fa' : '#475569' }}
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

      {/* Footer status */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid #1a2d4a' }}>
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-2 h-2 rounded-full pulse-dot flex-shrink-0"
            style={{ background: '#10b981', boxShadow: '0 0 6px #10b981' }}
          />
          <span className="text-[11px]" style={{ color: '#3d5a7a' }}>Hệ thống hoạt động</span>
        </div>
        <p className="text-[10px]" style={{ color: '#2a3f58' }}>Graph-based Models · v1.0</p>
      </div>
    </aside>
  )
}
