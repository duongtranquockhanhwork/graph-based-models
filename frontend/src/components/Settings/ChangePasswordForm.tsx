import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

export default function ChangePasswordForm() {
  const { changePassword } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (next.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự')
      return
    }
    if (next !== confirm) {
      toast.error('Mật khẩu nhập lại không khớp')
      return
    }
    setLoading(true)
    try {
      await changePassword(current, next)
      toast.success('Đã đổi mật khẩu')
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Không thể đổi mật khẩu'
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
        placeholder="Mật khẩu hiện tại"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        required
      />
      <input
        type="password"
        className="field-input"
        placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        required
      />
      <input
        type="password"
        className="field-input"
        placeholder="Nhập lại mật khẩu mới"
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
        {loading ? 'Đang lưu...' : 'Đổi mật khẩu'}
      </button>
    </form>
  )
}
