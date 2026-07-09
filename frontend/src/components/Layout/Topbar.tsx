import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Activity, CalendarDays, ChevronDown, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const PAGE_INFO: Record<string, { title: string; breadcrumb: string }> = {
  '/dashboard': { title: 'Tổng quan thị trường', breadcrumb: 'Dashboard' },
  '/news': { title: 'Tin tức', breadcrumb: 'Danh sách tin tức & kết quả phân tích NLP' },
  '/stocks': { title: 'Cổ phiếu', breadcrumb: 'Danh mục mã cổ phiếu theo dõi' },
  '/events': { title: 'Sự kiện tài chính', breadcrumb: 'Sự kiện được nhận diện từ tin tức' },
  '/sentiment': { title: 'Phân tích cảm xúc', breadcrumb: 'Tổng hợp Sentiment theo thời gian & cổ phiếu' },
  '/prediction': { title: 'Dự đoán xu hướng', breadcrumb: 'Graph-enhanced Machine Learning' },
  '/graph': { title: 'Knowledge Graph', breadcrumb: 'Mạng lưới tri thức trực quan' },
  '/reports': { title: 'Báo cáo', breadcrumb: 'Đánh giá mô hình · Metrics' },
  '/settings': { title: 'Cài đặt', breadcrumb: 'Hồ sơ cá nhân & giao diện' },
  '/import': { title: 'Nhập dữ liệu tin tức', breadcrumb: 'Import · CSV / URL / Thủ công' },
}

export default function Topbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const info = PAGE_INFO[pathname] || { title: 'FinNexus KG', breadcrumb: '' }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const initial = (user?.full_name || user?.email || '?').charAt(0).toUpperCase()

  const now = new Date()
  const dateStr = now.toLocaleDateString('vi-VN', {
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
      <div className="flex items-center gap-3">
        <div>
          <h2 className="font-semibold text-[14px] leading-tight" style={{ color: 'var(--text-primary)' }}>{info.title}</h2>
          <p className="text-[11px] leading-tight mt-0.5" style={{ color: 'var(--text-faint)' }}>
            {info.breadcrumb}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5" style={{ color: 'var(--text-faint)' }}>
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
          <span className="text-[11px] text-emerald-600 font-medium">Live</span>
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
                <p className="text-[12px] truncate" style={{ color: 'var(--text-primary)' }}>{user?.full_name || 'Người dùng'}</p>
                <p className="text-[11px] truncate" style={{ color: 'var(--text-faint)' }}>
                  {user?.email}
                </p>
              </div>
              <button
                onClick={() => { setMenuOpen(false); navigate('/settings') }}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[13px] hover:bg-black/5 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cài đặt
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[13px] hover:bg-black/5 transition-colors"
                style={{ color: '#dc2626' }}
              >
                <LogOut size={14} />
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
