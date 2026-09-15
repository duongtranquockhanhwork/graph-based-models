import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { isPasswordStrong, getPasswordRequirementsMessage } from '../../utils/passwordStrength'

export default function ChangePasswordForm() {
  const { changePassword } = useAuth()
  const { t } = useLanguage()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isPasswordStrong(next)) {
      toast.error(getPasswordRequirementsMessage(t))
      return
    }
    if (next !== confirm) {
      toast.error(t('changePassword.confirmMismatch'))
      return
    }
    setLoading(true)
    try {
      await changePassword(current, next)
      toast.success(t('changePassword.changeSuccess'))
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || t('changePassword.changeError')
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="password"
        className="field-input"
        placeholder={t('changePassword.currentPasswordPlaceholder')}
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        required
      />
      <input
        type="password"
        className="field-input"
        placeholder={t('changePassword.newPasswordPlaceholder')}
        value={next}
        onChange={(e) => setNext(e.target.value)}
        required
      />
      <input
        type="password"
        className="field-input"
        placeholder={t('changePassword.confirmPasswordPlaceholder')}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
      />
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 rounded-xl text-[13px] font-medium text-white disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)' }}
      >
        {loading ? t('changePassword.saving') : t('changePassword.submit')}
      </button>
    </form>
  )
}
