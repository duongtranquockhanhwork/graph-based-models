import { useState } from 'react'
import toast from 'react-hot-toast'
import { Pencil, Check, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function ProfileEditForm() {
  const { user, updateProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(user?.full_name || '')
  const [saving, setSaving] = useState(false)

  const startEdit = () => {
    setValue(user?.full_name || '')
    setEditing(true)
  }

  const save = async () => {
    if (!value.trim()) {
      toast.error('Họ tên không được để trống')
      return
    }
    setSaving(true)
    try {
      await updateProfile(value.trim())
      toast.success('Đã cập nhật họ tên')
      setEditing(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Không thể cập nhật họ tên'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button
        onClick={startEdit}
        className="inline-flex items-center gap-1.5 text-[11px] mt-2 transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        <Pencil size={11} /> Sửa họ tên
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <input
        className="field-input h-8 text-[12px] py-1"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        autoFocus
      />
      <button onClick={save} disabled={saving} className="p-1.5 rounded-lg disabled:opacity-50" style={{ color: '#10b981' }} title="Lưu">
        <Check size={14} />
      </button>
      <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-secondary)' }} title="Huỷ">
        <X size={14} />
      </button>
    </div>
  )
}
