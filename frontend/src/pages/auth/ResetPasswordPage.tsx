import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import AuthLayout from '../../components/Auth/AuthLayout'
import { useAuth } from '../../context/AuthContext'

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp')
      return
    }
    if (password.length < 6) {
      toast.error('Mật khẩu cần tối thiểu 6 ký tự')
      return
    }
    setIsSubmitting(true)
    try {
      await resetPassword(token, password)
      toast.success('Đặt lại mật khẩu thành công, vui lòng đăng nhập lại')
      navigate('/login', { replace: true })
    } catch {
      toast.error('Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Đặt lại mật khẩu" subtitle="Link không hợp lệ">
        <p className="text-sm" style={{ color: '#94a3b8' }}>
          Link đặt lại mật khẩu bị thiếu hoặc không hợp lệ. Vui lòng yêu cầu lại từ trang{' '}
          <Link to="/forgot-password" className="text-blue-400 hover:text-blue-300 font-medium">
            Quên mật khẩu
          </Link>
          .
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Đặt lại mật khẩu" subtitle="Nhập mật khẩu mới cho tài khoản của bạn">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[12px] font-medium mb-1.5 block" style={{ color: '#94a3b8' }}>
            Mật khẩu mới
          </label>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#475569' }} />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              className="field-input pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2"
              style={{ color: '#475569' }}
              tabIndex={-1}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div>
          <label className="text-[12px] font-medium mb-1.5 block" style={{ color: '#94a3b8' }}>
            Xác nhận mật khẩu
          </label>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#475569' }} />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              className="field-input pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2"
              style={{ color: '#475569' }}
              tabIndex={-1}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 rounded-lg font-semibold text-sm text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
          style={{
            background: 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%)',
            boxShadow: '0 0 20px rgba(37,99,235,0.35)',
          }}
        >
          {isSubmitting && <Loader2 size={15} className="animate-spin" />}
          Đặt lại mật khẩu
        </button>
      </form>
    </AuthLayout>
  )
}
