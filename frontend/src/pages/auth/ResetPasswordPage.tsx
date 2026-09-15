import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import AuthLayout from '../../components/Auth/AuthLayout'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { getPasswordRequirementsMessage, isPasswordStrong, PASSWORD_MIN_LENGTH } from '../../utils/passwordStrength'

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth()
  const { t } = useLanguage()
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
      toast.error(t('resetPassword.passwordMismatchToast'))
      return
    }
    if (!isPasswordStrong(password)) {
      toast.error(getPasswordRequirementsMessage(t))
      return
    }
    setIsSubmitting(true)
    try {
      await resetPassword(token, password)
      toast.success(t('resetPassword.resetSuccessToast'))
      navigate('/login', { replace: true })
    } catch {
      toast.error(t('resetPassword.resetErrorToast'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!token) {
    return (
      <AuthLayout title={t('resetPassword.title')} subtitle={t('resetPassword.invalidLinkSubtitle')}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('resetPassword.invalidLinkMessagePrefix')}{' '}
          <Link to="/forgot-password" className="text-blue-400 hover:text-blue-300 font-medium">
            {t('resetPassword.forgotPasswordPageLink')}
          </Link>
          .
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('resetPassword.title')} subtitle={t('resetPassword.subtitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[12px] font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
            {t('resetPassword.newPasswordLabel')}
          </label>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={PASSWORD_MIN_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('resetPassword.passwordHintPlaceholder')}
              className="field-input pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
              tabIndex={-1}
              aria-label={showPassword ? t('resetPassword.hidePasswordAria') : t('resetPassword.showPasswordAria')}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div>
          <label className="text-[12px] font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
            {t('resetPassword.confirmPasswordLabel')}
          </label>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={PASSWORD_MIN_LENGTH}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('resetPassword.confirmPasswordPlaceholder')}
              className="field-input pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
              tabIndex={-1}
              aria-label={showPassword ? t('resetPassword.hidePasswordAria') : t('resetPassword.showPasswordAria')}
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
          {t('resetPassword.submitButton')}
        </button>
      </form>
    </AuthLayout>
  )
}
