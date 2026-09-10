import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import AuthLayout from '../../components/Auth/AuthLayout'
import GoogleAuthButton from '../../components/Auth/GoogleAuthButton'
import { useAuth } from '../../context/AuthContext'
import type { User } from '../../types'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const from = (location.state as { from?: string })?.from

  const redirectAfterLogin = (user: User) => {
    navigate(from || (user.role === 'admin' ? '/admin/dashboard' : '/dashboard'), { replace: true })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const user = await login(email, password)
      toast.success('Đăng nhập thành công')
      redirectAfterLogin(user)
    } catch {
      toast.error('Email hoặc mật khẩu không đúng')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Đăng nhập" subtitle="Chào mừng quay lại FinNexus KG">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[12px] font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
            Email
          </label>
          <div className="relative">
            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ban@example.com"
              className="field-input pl-10"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              Mật khẩu
            </label>
            <Link to="/forgot-password" className="text-[12px] text-blue-400 hover:text-blue-300">
              Quên mật khẩu?
            </Link>
          </div>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="field-input pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
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
            background: '#1d4ed8',
          }}
        >
          {isSubmitting && <Loader2 size={15} className="animate-spin" />}
          Đăng nhập
        </button>
      </form>

      <GoogleAuthButton onSuccess={redirectAfterLogin} />

      <p className="text-center text-[13px] mt-6" style={{ color: 'var(--text-secondary)' }}>
        Chưa có tài khoản?{' '}
        <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium">
          Đăng ký ngay
        </Link>
      </p>
    </AuthLayout>
  )
}
