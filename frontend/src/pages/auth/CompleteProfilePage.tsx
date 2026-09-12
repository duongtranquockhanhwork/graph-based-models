import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Calendar, Loader2, User as UserIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import AuthLayout from '../../components/Auth/AuthLayout'
import EmailOtpForm from '../../components/Auth/EmailOtpForm'
import { useAuth } from '../../context/AuthContext'

const HOME_BY_ROLE: Record<'admin' | 'customer', string> = {
  admin: '/admin/dashboard',
  customer: '/dashboard',
}

const todayISO = new Date().toISOString().slice(0, 10)

function errDetail(err: unknown): string | undefined {
  return (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
}

export default function CompleteProfilePage() {
  const { user, isAuthenticated, isLoading, completeProfile, linkEmail } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [dateOfBirth, setDateOfBirth] = useState(user?.date_of_birth || '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const needsVerification = !!user && !user.phone_verified && !user.email_verified

  useEffect(() => {
    if (user?.profile_complete) {
      navigate(HOME_BY_ROLE[user.role], { replace: true })
    }
  }, [user, navigate])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="w-10 h-10 rounded-full skeleton" />
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await completeProfile(fullName, dateOfBirth)
      toast.success('Đã lưu thông tin hồ sơ')
    } catch (err) {
      toast.error(errDetail(err) || 'Không thể lưu thông tin')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEmailLinked = async (email: string, code: string) => {
    try {
      await linkEmail(email, code)
      toast.success('Đã liên kết email')
    } catch (err) {
      toast.error(errDetail(err) || 'Không thể liên kết email')
    }
  }

  return (
    <AuthLayout title="Hoàn tất hồ sơ" subtitle="Cần thêm vài thông tin trước khi tiếp tục">
      <form onSubmit={handleSubmit} className="space-y-4">
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
          Lưu thông tin
        </button>
      </form>

      {needsVerification && (
        <div className="mt-6 pt-5 space-y-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            Tài khoản của bạn chưa xác thực OTP qua email — bắt buộc để tiếp tục sử dụng.
          </p>
          <EmailOtpForm onVerified={handleEmailLinked} submitLabel="Liên kết email" />
        </div>
      )}
    </AuthLayout>
  )
}
