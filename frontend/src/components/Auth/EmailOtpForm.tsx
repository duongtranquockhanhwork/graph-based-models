import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Loader2, Mail, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLanguage } from '../../context/LanguageContext'
import { authApi } from '../../services/authApi'
import { getEmailFormatMessage, isGmailAddress } from '../../utils/emailFormat'

const EMAIL_EXISTS_CHECK_DEBOUNCE_MS = 500

interface EmailOtpFormProps {
  // Gọi khi người dùng đã nhập mã — cha (đăng ký / đăng nhập / liên kết)
  // chịu trách nhiệm gửi email+code tới đúng endpoint backend.
  onVerified: (email: string, code: string) => void | Promise<void>
  submitLabel?: string
  // Chạy trước khi gửi OTP — trả về false để chặn gửi (vd. cha còn thiếu
  // trường bắt buộc) và tự hiển thị lý do; form KHÔNG tự ẩn nút chờ điều kiện.
  onBeforeSend?: () => boolean
}

function errDetail(err: unknown): string | undefined {
  return (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
}

const RESEND_COOLDOWN_SECONDS = 60

const buttonClass =
  'w-full py-2.5 rounded-lg font-semibold text-sm text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60'
const buttonStyle = {
  background: 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%)',
  boxShadow: '0 0 20px rgba(37,99,235,0.35)',
}

export default function EmailOtpForm({ onVerified, submitLabel, onBeforeSend }: EmailOtpFormProps) {
  const { t } = useLanguage()
  const resolvedSubmitLabel = submitLabel || t('emailOtp.verifyButton')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const [emailExists, setEmailExists] = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const existsCheckSeq = useRef(0)

  const trimmedEmail = email.trim()
  const formatValid = trimmedEmail === '' || isGmailAddress(trimmedEmail)
  const showFormatError = trimmedEmail !== '' && !formatValid
  const showExistsError = !showFormatError && trimmedEmail !== '' && emailExists && !checkingEmail
  const canSendOtp = trimmedEmail !== '' && formatValid && !emailExists && !checkingEmail

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current)
    }
  }, [])

  // Báo ngay "email này đã có tài khoản" trước khi người dùng bấm gửi, để
  // khỏi tốn một email OTP thật rồi mới báo lỗi ở bước xác nhận.
  useEffect(() => {
    setEmailExists(false)
    if (!isGmailAddress(trimmedEmail)) {
      setCheckingEmail(false)
      return
    }
    const seq = ++existsCheckSeq.current
    setCheckingEmail(true)
    const timer = setTimeout(() => {
      authApi
        .emailExists(trimmedEmail)
        .then((res) => {
          if (existsCheckSeq.current === seq) setEmailExists(res.data.exists)
        })
        .catch(() => {
          // Lỗi mạng khi kiểm tra: không chặn người dùng, để lỗi thật (nếu
          // có) lộ ra khi họ bấm "Gửi mã xác thực".
        })
        .finally(() => {
          if (existsCheckSeq.current === seq) setCheckingEmail(false)
        })
    }, EMAIL_EXISTS_CHECK_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedEmail])

  const startResendCooldown = () => {
    if (cooldownTimer.current) clearInterval(cooldownTimer.current)
    setResendCooldown(RESEND_COOLDOWN_SECONDS)
    cooldownTimer.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current)
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  const sendOtp = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSendOtp) return
    if (onBeforeSend && !onBeforeSend()) return
    setIsSubmitting(true)
    try {
      await authApi.emailOtpRequest(trimmedEmail)
      setStep('otp')
      startResendCooldown()
      toast.success(t('emailOtp.otpSentToast'))
    } catch (err) {
      toast.error(errDetail(err) || t('emailOtp.otpSendErrorToast'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const resendOtp = async () => {
    if (resendCooldown > 0 || isResending) return
    setIsResending(true)
    try {
      await authApi.emailOtpRequest(trimmedEmail)
      startResendCooldown()
      toast.success(t('emailOtp.otpResentToast'))
    } catch (err) {
      toast.error(errDetail(err) || t('emailOtp.otpResendErrorToast'))
    } finally {
      setIsResending(false)
    }
  }

  const confirmOtp = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onVerified(trimmedEmail, code)
    } catch (err) {
      toast.error(errDetail(err) || t('emailOtp.otpInvalidToast'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      {step === 'email' ? (
        <form onSubmit={sendOtp} className="space-y-3">
          <div className="relative">
            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailOtp.emailPlaceholder')}
              className="field-input pl-10"
            />
          </div>
          {showFormatError && (
            <p className="text-[11px] -mt-1.5" style={{ color: '#f87171' }}>
              {getEmailFormatMessage(t)}
            </p>
          )}
          {showExistsError && (
            <p className="text-[11px] -mt-1.5" style={{ color: '#f87171' }}>
              {t('emailOtp.emailExistsError')}
            </p>
          )}
          <button type="submit" disabled={isSubmitting || !canSendOtp} className={buttonClass} style={buttonStyle}>
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}
            {t('emailOtp.sendOtpButton')}
          </button>
        </form>
      ) : (
        <form onSubmit={confirmOtp} className="space-y-3">
          <div className="relative">
            <ShieldCheck size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              required
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('emailOtp.otpPlaceholder')}
              className="field-input pl-10"
            />
          </div>
          <button type="submit" disabled={isSubmitting} className={buttonClass} style={buttonStyle}>
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}
            {resolvedSubmitLabel}
          </button>
          <div className="flex items-center justify-between text-[12px]">
            <button
              type="button"
              onClick={() => setStep('email')}
              className="text-blue-400 hover:text-blue-300"
            >
              {t('emailOtp.changeEmailButton')}
            </button>
            <button
              type="button"
              onClick={resendOtp}
              disabled={resendCooldown > 0 || isResending}
              className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:hover:text-blue-400"
            >
              {isResending && <Loader2 size={12} className="animate-spin" />}
              {resendCooldown > 0
                ? t('emailOtp.resendButtonCooldown', { seconds: resendCooldown })
                : t('emailOtp.resendButton')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
