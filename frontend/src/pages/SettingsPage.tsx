import { Link } from 'react-router-dom'
import { KeyRound, Mail, Palette, Phone, User as UserIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import ThemeToggle from '../components/ThemeToggle'
import ProfileEditForm from '../components/Settings/ProfileEditForm'
import ChangePasswordForm from '../components/Settings/ChangePasswordForm'

export default function SettingsPage() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const initial = (user?.full_name || user?.email || '?').charAt(0).toUpperCase()

  return (
    <div className="p-6 max-w-2xl space-y-5 fade-in">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Cài đặt</h2>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Thông tin tài khoản và tuỳ chỉnh giao diện
        </p>
      </div>

      <div className="section-card">
        <h3 className="text-[13px] font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <UserIcon size={15} /> Hồ sơ cá nhân
        </h3>
        <div className="flex items-center gap-4">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={user.full_name || user.email} className="w-16 h-16 rounded-full" />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-semibold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%)' }}
            >
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{user?.full_name || 'Người dùng'}</p>
            <div className="flex items-center gap-1.5 mt-1" style={{ color: 'var(--text-muted)' }}>
              {user?.email ? <Mail size={12} /> : <Phone size={12} />}
              <span className="text-[12px]">{user?.email || user?.phone}</span>
            </div>
            <span className="inline-block mt-2 badge-blue text-[11px] px-2 py-0.5 rounded-full">
              {user?.role === 'admin' ? 'Quản trị viên' : 'Nhà đầu tư'}
            </span>
            <ProfileEditForm />
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
          Đổi mật khẩu tài khoản của bạn
        </p>
        <ChangePasswordForm />
        <Link
          to="/forgot-password"
          className="inline-block mt-3 text-[12px] underline"
          style={{ color: 'var(--text-muted)' }}
        >
          Quên mật khẩu hiện tại?
        </Link>
      </div>
    </div>
  )
}
