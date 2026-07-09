import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Save } from 'lucide-react'
import adminApi from '../../services/adminApi'
import type { SystemSetting } from '../../types'
import { SkeletonBlock } from '../../components/Admin/AdminWidgets'

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    adminApi.settings
      .list()
      .then((r) => {
        setSettings(r.data)
        const initial: Record<string, string> = {}
        for (const s of r.data as SystemSetting[]) initial[s.key] = s.value
        setDrafts(initial)
      })
      .finally(() => setLoading(false))
  }, [])

  const save = async (key: string) => {
    setSavingKey(key)
    try {
      await adminApi.settings.update(key, drafts[key])
      toast.success('Đã lưu cấu hình')
    } catch {
      toast.error('Lỗi khi lưu cấu hình')
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="p-6 space-y-4 fade-in">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Cấu hình hệ thống</h2>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Điều chỉnh ngưỡng phân loại sentiment và ngưỡng đưa bài báo vào hàng chờ gán nhãn thủ công — áp dụng ngay cho lần phân tích tiếp theo
        </p>
      </div>

      {loading ? (
        <SkeletonBlock className="h-64" />
      ) : (
        <div className="space-y-3">
          {settings.map((s) => (
            <div key={s.key} className="section-card flex flex-wrap items-end gap-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex-1 min-w-[220px]">
                <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{s.key}</p>
                {s.description && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>{s.description}</p>}
              </div>
              <input
                className="field-input w-32"
                value={drafts[s.key] ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [s.key]: e.target.value }))}
              />
              <button
                onClick={() => save(s.key)}
                disabled={savingKey === s.key}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #047857, #10b981)' }}
              >
                <Save size={13} /> Lưu
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
