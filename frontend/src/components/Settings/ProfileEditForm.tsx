import { useRef, useState, type ChangeEvent } from 'react'
import toast from 'react-hot-toast'
import { Camera, Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { fileToAvatarDataUrl } from '../../utils/imageResize'

const todayISO = new Date().toISOString().slice(0, 10)

export default function ProfileEditForm() {
  const { user, updateProfile } = useAuth()
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [dateOfBirth, setDateOfBirth] = useState(user?.date_of_birth || '')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar_url || null)
  // true khi người dùng vừa chọn ảnh mới hoặc bấm xoá — phân biệt với "chưa
  // đụng gì" để không gửi avatar_url lên mỗi lần chỉ đổi tên/ngày sinh.
  const [avatarDirty, setAvatarDirty] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initial = (user?.full_name || user?.email || user?.phone || '?').charAt(0).toUpperCase()
  const dirty =
    fullName.trim() !== (user?.full_name || '') ||
    dateOfBirth !== (user?.date_of_birth || '') ||
    avatarDirty

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await fileToAvatarDataUrl(file)
      setAvatarPreview(dataUrl)
      setAvatarDirty(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không xử lý được ảnh')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveAvatar = () => {
    setAvatarPreview(null)
    setAvatarDirty(true)
  }

  const handleSave = async () => {
    if (!fullName.trim()) {
      toast.error('Họ tên không được để trống')
      return
    }
    if (dateOfBirth && dateOfBirth > todayISO) {
      toast.error('Ngày sinh không được vượt quá ngày hiện tại')
      return
    }
    setSaving(true)
    try {
      await updateProfile(fullName.trim(), dateOfBirth || undefined, avatarDirty ? avatarPreview || '' : undefined)
      setAvatarDirty(false)
      toast.success('Đã lưu hồ sơ')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Không thể lưu hồ sơ'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          {avatarPreview ? (
            <img src={avatarPreview} alt={fullName || 'avatar'} className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%)' }}
            >
              {initial}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-60"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            title="Đổi ảnh đại diện"
            aria-label="Đổi ảnh đại diện"
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
        {avatarPreview && (
          <button
            type="button"
            onClick={handleRemoveAvatar}
            className="text-[12px] hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            Xoá ảnh đại diện
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[12px] font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
            Họ và tên
          </label>
          <input className="field-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label className="text-[12px] font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
            Ngày sinh
          </label>
          <input
            type="date"
            max={todayISO}
            className="field-input"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !dirty}
        className="px-4 py-2 rounded-xl text-[13px] font-medium text-white disabled:opacity-50 transition-opacity"
        style={{ background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)' }}
      >
        {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
      </button>
    </div>
  )
}
