import { useState, type FormEvent } from 'react'
import { Loader2, Mail, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '../../services/authApi'

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

const buttonClass =
  'w-full py-2.5 rounded-lg font-semibold text-sm text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60'
const buttonStyle = {
  background: 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%)',
  boxShadow: '0 0 20px rgba(37,99,235,0.35)',
}

export default function EmailOtpForm({ onVerified, submitLabel = 'Xác thực', onBeforeSend }: EmailOtpFormProps) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const sendOtp = async (e: FormEvent) => {
    e.preventDefault()
    if (onBeforeSend && !onBeforeSend()) return
    setIsSubmitting(true)
    try {
      await authApi.emailOtpRequest(email)
      setStep('otp')
      toast.success('Đã gửi mã xác thực tới email')
    } catch (err) {
      toast.error(errDetail(err) || 'Không gửi được mã, kiểm tra lại địa chỉ email')
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmOtp = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onVerified(email, code)
    } catch (err) {
      toast.error(errDetail(err) || 'Mã xác thực không đúng hoặc đã hết hạn')
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
              placeholder="ban@example.com"
              className="field-input pl-10"
            />
          </div>
          <button type="submit" disabled={isSubmitting} className={buttonClass} style={buttonStyle}>
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}
            Gửi mã xác thực
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
              placeholder="Mã xác thực 6 số"
              className="field-input pl-10"
            />
          </div>
          <button type="submit" disabled={isSubmitting} className={buttonClass} style={buttonStyle}>
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}
            {submitLabel}
          </button>
          <button
            type="button"
            onClick={() => setStep('email')}
            className="w-full text-center text-[12px] text-blue-400 hover:text-blue-300"
          >
            Đổi địa chỉ email
          </button>
        </form>
      )}
    </div>
  )
}
