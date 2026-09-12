import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Mail, MailCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import AuthLayout from '../../components/Auth/AuthLayout'
import { useAuth } from '../../context/AuthContext'

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await forgotPassword(email)
      setSent(true)
    } catch {
      toast.error('Có lỗi xảy ra, vui lòng thử lại')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Quên mật khẩu" subtitle="Nhập email để nhận hướng dẫn đặt lại mật khẩu">
      {sent ? (
        <div className="text-center py-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}
          >
            <MailCheck size={20} className="text-emerald-400" />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Nếu <span style={{ color: 'var(--text-primary)' }}>{email}</span> tồn tại trong hệ thống, một email hướng
            dẫn đặt lại mật khẩu đã được gửi đến bạn.
          </p>
        </div>
      ) : (
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-lg font-semibold text-sm text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
            style={{
              background: '#1d4ed8',
            }}
          >
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}
            Gửi hướng dẫn
          </button>
        </form>
      )}

      <p className="text-center text-[13px] mt-6" style={{ color: 'var(--text-secondary)' }}>
        <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">
          Quay lại đăng nhập
        </Link>
      </p>
    </AuthLayout>
  )
}
