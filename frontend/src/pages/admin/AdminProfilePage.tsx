import { Link } from 'react-router-dom'
import { KeyRound, Mail, Palette, User as UserIcon } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import ThemeToggle from '../../components/ThemeToggle'

export default function AdminProfilePage() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const initial = (user?.full_name || user?.email || '?').charAt(0).toUpperCase()

  return (
    <div className="p-6 max-w-2xl space-y-5 fade-in">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Hồ sơ cá nhân</h2>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Thông tin tài khoản quản trị và tuỳ chỉnh giao diện
        </p>
      </div>

      <div className="section-card">
        <h3 className="text-[13px] font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <UserIcon size={15} /> Tài khoản
        </h3>
        <div className="flex items-center gap-4">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={user.full_name || user.email} className="w-16 h-16 rounded-full" />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-semibold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #047857 0%, #10b981 100%)' }}
            >
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{user?.full_name || 'Quản trị viên'}</p>
            <div className="flex items-center gap-1.5 mt-1" style={{ color: 'var(--text-muted)' }}>
              <Mail size={12} />
              <span className="text-[12px]">{user?.email}</span>
            </div>
            <span
              className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1px solid rgba(16,185,129,0.25)' }}
            >
              Quản trị viên
            </span>
          </div>
        </div>
      </div>

      <div className="section-card">
        <h3 className="text-[13px] font-semibold mb-1 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Palette size={15} /> Giao diện
        </h3>
        <p className="text-[12px] mb-4" style={{ color: 'var(--text-muted)' }}>
          Chọn giao diện sáng hoặc tối cho toàn bộ ứng dụng
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            {theme === 'dark' ? 'Đang dùng giao diện Tối' : 'Đang dùng giao diện Sáng'}
          </span>
          <ThemeToggle />
        </div>
      </div>

      <div className="section-card">
        <h3 className="text-[13px] font-semibold mb-1 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <KeyRound size={15} /> Bảo mật
        </h3>
        <p className="text-[12px] mb-3" style={{ color: 'var(--text-muted)' }}>
          Đặt lại mật khẩu qua email đã đăng ký
        </p>
        <Link
          to="/forgot-password"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
        >
          Đổi mật khẩu
        </Link>
      </div>
    </div>
  )
}
