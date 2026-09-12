import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Calendar, Eye, EyeOff, Loader2, Lock, Mail, User as UserIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import BrandMark from '../../components/common/BrandMark'
import EmailOtpForm from '../../components/Auth/EmailOtpForm'
import { useAuth } from '../../context/AuthContext'
import type { User } from '../../types'
import { isPasswordStrong, PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENTS_MESSAGE } from '../../utils/passwordStrength'

type Mode = 'login' | 'register'

const PANEL_BG = '#0a1628'
const todayISO = new Date().toISOString().slice(0, 10)

function errDetail(err: unknown): string | undefined {
  return (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
}

interface LoginFormProps {
  email: string
  setEmail: Dispatch<SetStateAction<string>>
  password: string
  setPassword: Dispatch<SetStateAction<string>>
  showPassword: boolean
  setShowPassword: Dispatch<SetStateAction<boolean>>
  isSubmitting: boolean
  onSubmit: (e: FormEvent) => void
  onForgotPassword: () => void
}

function LoginForm({
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  isSubmitting,
  onSubmit,
  onForgotPassword,
}: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-[12px] text-blue-400 hover:text-blue-300"
          >
            Quên mật khẩu?
          </button>
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
          background: 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%)',
          boxShadow: '0 0 20px rgba(37,99,235,0.35)',
        }}
      >
        {isSubmitting && <Loader2 size={15} className="animate-spin" />}
        Đăng nhập
      </button>
    </form>
  )
}

interface RegisterFormProps {
  fullName: string
  setFullName: Dispatch<SetStateAction<string>>
  dateOfBirth: string
  setDateOfBirth: Dispatch<SetStateAction<string>>
  password: string
  setPassword: Dispatch<SetStateAction<string>>
  confirmPassword: string
  setConfirmPassword: Dispatch<SetStateAction<string>>
  showPassword: boolean
  setShowPassword: Dispatch<SetStateAction<boolean>>
  validateCommonFields: () => boolean
  onEmailVerified: (email: string, code: string) => Promise<void>
}

function RegisterForm({
  fullName,
  setFullName,
  dateOfBirth,
  setDateOfBirth,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  showPassword,
  setShowPassword,
  validateCommonFields,
  onEmailVerified,
}: RegisterFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-[12px] font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
          Họ và tên
        </label>
        <div className="relative">
          <UserIcon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nguyễn Văn A"
            className="field-input pl-10"
          />
        </div>
      </div>

      <div>
        <label className="text-[12px] font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
          Ngày sinh
        </label>
        <div className="relative">
          <Calendar size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type="date"
            required
            max={todayISO}
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="field-input pl-10"
          />
        </div>
      </div>

      <div>
        <label className="text-[12px] font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
          Mật khẩu
        </label>
        <div className="relative">
          <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type={showPassword ? 'text' : 'password'}
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Chữ hoa, chữ thường, số, ký tự đặc biệt"
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
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-faint)' }}>
          {PASSWORD_REQUIREMENTS_MESSAGE}
        </p>
      </div>

      <div>
        <label className="text-[12px] font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
          Nhập lại mật khẩu
        </label>
        <div className="relative">
          <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type={showPassword ? 'text' : 'password'}
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Nhập lại mật khẩu ở trên"
            className="field-input pl-10 pr-10"
          />
        </div>
      </div>

      <EmailOtpForm onVerified={onEmailVerified} onBeforeSend={validateCommonFields} submitLabel="Tạo tài khoản" />
    </div>
  )
}

export default function AuthPage() {
  const { login, registerWithEmail } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const initialMode: Mode = location.pathname === '/register' ? 'register' : 'login'
  const [mode, setMode] = useState<Mode>(initialMode)
  // Nội dung form thật sự hiển thị — trễ hơn `mode` một nhịp để khớp lúc
  // khối trượt gần xong, giống hiệu ứng trong video tham khảo thay vì đổi
  // nội dung ngay lập tức giữa chừng cú trượt.
  const [displayMode, setDisplayMode] = useState<Mode>(initialMode)

  // Đồng bộ khi điều hướng tới từ bên ngoài cú bấm chuyển đổi của chính trang
  // này (link trực tiếp, nút Back/Forward của trình duyệt) — snap ngay,
  // không cần hiệu ứng trễ vì đây là một lượt tải trang mới, không phải
  // click chuyển đổi.
  useEffect(() => {
    const pathMode: Mode = location.pathname === '/register' ? 'register' : 'login'
    setMode((current) => {
      if (current === pathMode) return current
      setDisplayMode(pathMode)
      return pathMode
    })
  }, [location.pathname])

  const toggle = () => {
    const next: Mode = mode === 'login' ? 'register' : 'login'
    setMode(next)
    navigate(next === 'login' ? '/login' : '/register', { replace: true })
    window.setTimeout(() => setDisplayMode(next), 350)
  }

  // ---- Đăng nhập ----
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const redirectAfterLogin = (user: User) => {
    const from = (location.state as { from?: string })?.from
    navigate(from || (user.role === 'admin' ? '/admin/dashboard' : '/dashboard'), { replace: true })
  }

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const user = await login(email, password)
      toast.success('Đăng nhập thành công')
      redirectAfterLogin(user)
    } catch (err) {
      toast.error(errDetail(err) || 'Email hoặc mật khẩu không đúng')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ---- Đăng ký ----
  const [fullName, setFullName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')
  const [showRegPassword, setShowRegPassword] = useState(false)

  const validateCommonFields = (): boolean => {
    if (!fullName.trim()) {
      toast.error('Vui lòng nhập họ và tên')
      return false
    }
    if (!dateOfBirth) {
      toast.error('Vui lòng chọn ngày sinh')
      return false
    }
    if (dateOfBirth > todayISO) {
      toast.error('Ngày sinh không được vượt quá ngày hiện tại')
      return false
    }
    if (!isPasswordStrong(regPassword)) {
      toast.error(PASSWORD_REQUIREMENTS_MESSAGE)
      return false
    }
    if (regPassword !== regConfirmPassword) {
      toast.error('Mật khẩu nhập lại không khớp')
      return false
    }
    return true
  }

  const handleEmailVerified = async (verifiedEmail: string, code: string) => {
    await registerWithEmail(verifiedEmail, code, fullName, dateOfBirth, regPassword)
    toast.success('Tạo tài khoản thành công')
    navigate('/dashboard', { replace: true })
  }

  const isRegister = mode === 'register'

  const loginFormEl = (
    <LoginForm
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      showPassword={showPassword}
      setShowPassword={setShowPassword}
      isSubmitting={isSubmitting}
      onSubmit={handleLoginSubmit}
      onForgotPassword={() => navigate('/forgot-password')}
    />
  )
  const registerFormEl = (
    <RegisterForm
      fullName={fullName}
      setFullName={setFullName}
      dateOfBirth={dateOfBirth}
      setDateOfBirth={setDateOfBirth}
      password={regPassword}
      setPassword={setRegPassword}
      confirmPassword={regConfirmPassword}
      setConfirmPassword={setRegConfirmPassword}
      showPassword={showRegPassword}
      setShowPassword={setShowRegPassword}
      validateCommonFields={validateCommonFields}
      onEmailVerified={handleEmailVerified}
    />
  )

  return (
    <div className="min-h-screen flex items-center justify-center auth-shell p-4 sm:p-8" style={{ background: PANEL_BG }}>
      {/* Desktop: khung trượt 2 khối, giống hiệu ứng video tham khảo */}
      <div className="hidden lg:block relative w-full max-w-5xl" style={{ height: '660px' }}>
        <div className="absolute inset-0 rounded-[28px] overflow-hidden" style={{ boxShadow: '0 25px 70px rgba(0,0,0,0.55)' }}>
          {/* Brand panel — trượt giữa trái/phải, mép bo cong lớn đảo chiều theo */}
          <div
            className="absolute top-0 h-full w-[44%] flex flex-col justify-between p-12 transition-all duration-700 ease-in-out"
            style={{
              left: isRegister ? '56%' : '0%',
              background: 'linear-gradient(160deg, #07111f 0%, #050c1a 60%, #0a1628 100%)',
              borderRadius: isRegister ? '30% 0 0 30% / 50% 0 0 50%' : '0 30% 30% 0 / 0 50% 50% 0',
            }}
          >
            <div className="relative flex items-center gap-3">
              <div
                className="flex-shrink-0 rounded-xl"
                style={{ boxShadow: '0 0 24px rgba(37,99,235,0.45), 0 2px 8px rgba(0,0,0,0.4)' }}
              >
                <BrandMark size={40} />
              </div>
              <h1 className="font-bold text-base leading-tight gradient-text">FinNexus KG</h1>
            </div>

            <div className="relative">
              <h2 className="text-3xl font-bold text-white leading-snug mb-8">
                {isRegister ? 'Xin chào!' : 'Chào mừng trở lại!'}
              </h2>

              <div className="flex items-center gap-3">
                <span className="text-sm" style={{ color: '#94a3b8' }}>
                  {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
                </span>
                <button
                  type="button"
                  onClick={toggle}
                  className="px-5 py-2 rounded-full text-[13px] font-semibold text-white transition-colors"
                  style={{ border: '1.5px solid rgba(255,255,255,0.5)' }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#fff'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.5)'
                  }}
                >
                  {isRegister ? 'Đăng nhập' : 'Đăng ký'}
                </button>
              </div>
            </div>

            <div />
          </div>

          {/* Form panel — trượt ngược chiều với brand panel */}
          <div
            className="absolute top-0 h-full w-[56%] flex items-center justify-center p-10 transition-all duration-700 ease-in-out"
            style={{ left: isRegister ? '0%' : '44%', background: PANEL_BG }}
          >
            <div className="w-full max-w-[380px]">
              <h2 className="text-2xl font-bold mb-6 text-white">
                {displayMode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập'}
              </h2>
              {displayMode === 'login' ? loginFormEl : registerFormEl}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: xếp dọc, không có khung trượt (không đủ chỗ cho 2 khối) */}
      <div className="lg:hidden w-full max-w-[400px] fade-in">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="flex-shrink-0 rounded-xl" style={{ boxShadow: '0 0 20px rgba(37,99,235,0.45)' }}>
            <BrandMark size={36} />
          </div>
          <h1 className="font-bold text-[15px] gradient-text">FinNexus KG</h1>
        </div>
        <h2 className="text-2xl font-bold mb-6 text-white">{isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}</h2>
        {mode === 'login' ? loginFormEl : registerFormEl}
        <p className="text-center text-[13px] mt-6" style={{ color: 'var(--text-secondary)' }}>
          {isRegister ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}
          <button type="button" onClick={toggle} className="text-blue-400 hover:text-blue-300 font-medium">
            {isRegister ? 'Đăng nhập' : 'Đăng ký ngay'}
          </button>
        </p>
      </div>
    </div>
  )
}
