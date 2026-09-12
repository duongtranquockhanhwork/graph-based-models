import { Link } from 'react-router-dom'
import { KeyRound, Mail, Palette, Phone, User as UserIcon } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import ThemeToggle from '../../components/ThemeToggle'
import ProfileEditForm from '../../components/Settings/ProfileEditForm'
import ChangePasswordForm from '../../components/Settings/ChangePasswordForm'

export default function AdminProfilePage() {
  const { user } = useAuth()
  const { theme } = useTheme()

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5 fade-in">
      <div>
        <h2 className="font-sans text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Hồ sơ cá nhân</h2>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Thông tin tài khoản quản trị và tuỳ chỉnh giao diện
        </p>
      </div>

      <div className="section-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <UserIcon size={15} /> Tài khoản
          </h3>
          <span
            className="text-[11px] px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1px solid rgba(16,185,129,0.25)' }}
          >
            Quản trị viên
          </span>
        </div>
        <div className="flex items-center gap-1.5 mb-4" style={{ color: 'var(--text-muted)' }}>
          {user?.email ? <Mail size={12} /> : <Phone size={12} />}
          <span className="text-[12px]">{user?.email || user?.phone}</span>
        </div>
        <ProfileEditForm />
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
