import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronDown, LogOut, ShieldHalf } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const PAGE_INFO: Record<string, { title: string; breadcrumb: string }> = {
  '/admin/dashboard': { title: 'Dashboard Admin', breadcrumb: 'Quản trị hệ thống' },
  '/admin/news': { title: 'Quản lý tin tức', breadcrumb: 'Danh sách & kiểm duyệt tin tức' },
  '/admin/stocks': { title: 'Quản lý cổ phiếu', breadcrumb: 'Danh mục mã cổ phiếu theo dõi' },
  '/admin/keywords': { title: 'Quản lý từ khoá sự kiện', breadcrumb: 'Từ điển nhận diện sự kiện NLP' },
  '/admin/data-validation': { title: 'Kiểm định dữ liệu', breadcrumb: 'Chất lượng dữ liệu pipeline' },
  '/admin/labeling': { title: 'Gán nhãn thủ công', breadcrumb: 'Hàng chờ xác nhận nhãn' },
  '/admin/validation-results': { title: 'Kết quả kiểm định', breadcrumb: 'Độ chính xác so với nhãn thủ công' },
  '/admin/users': { title: 'Quản lý người dùng', breadcrumb: 'Vai trò & trạng thái tài khoản' },
  '/admin/settings': { title: 'Cấu hình hệ thống', breadcrumb: 'Ngưỡng phân loại & xử lý' },
  '/admin/profile': { title: 'Hồ sơ cá nhân', breadcrumb: 'Thông tin tài khoản & giao diện' },
}

export default function AdminTopbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const info = PAGE_INFO[pathname] || { title: 'FinNexus KG Admin', breadcrumb: '' }

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
          <ShieldHalf size={11} className="text-emerald-500" />
          <span className="text-[11px] text-emerald-600 font-medium">Admin</span>
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
                style={{ background: 'linear-gradient(135deg, #047857 0%, #10b981 100%)' }}
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
                <p className="text-[12px] truncate" style={{ color: 'var(--text-primary)' }}>{user?.full_name || 'Quản trị viên'}</p>
                <p className="text-[11px] truncate" style={{ color: 'var(--text-faint)' }}>
                  {user?.email}
                </p>
              </div>
              <button
                onClick={() => { setMenuOpen(false); navigate('/admin/profile') }}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[13px] hover:bg-black/5 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                Hồ sơ cá nhân
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
