import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Trash2, Power } from 'lucide-react'
import adminApi from '../../services/adminApi'
import type { EventKeyword } from '../../types'
import { SkeletonBlock } from '../../components/Admin/AdminWidgets'

export default function AdminEventKeywordsPage() {
  const [keywords, setKeywords] = useState<EventKeyword[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ event_type: '', label_vi: '', keyword: '' })

  const load = () => {
    setLoading(true)
    adminApi.keywords.list().then((r) => setKeywords(r.data)).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const eventTypes = Array.from(new Set(keywords.map((k) => k.event_type)))

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.event_type.trim() || !form.keyword.trim()) return
    try {
      await adminApi.keywords.create({
        event_type: form.event_type.trim(),
        label_vi: form.label_vi.trim() || form.event_type.trim(),
        keyword: form.keyword.trim(),
      })
      toast.success('Đã thêm từ khoá')
      setForm({ event_type: '', label_vi: '', keyword: '' })
      load()
    } catch {
      toast.error('Lỗi khi thêm từ khoá')
    }
  }

  const toggleActive = async (kw: EventKeyword) => {
    await adminApi.keywords.update(kw.id, { is_active: !kw.is_active })
    load()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Xoá từ khoá này?')) return
    await adminApi.keywords.delete(id)
    toast.success('Đã xoá')
    load()
  }

  const grouped = eventTypes.map((type) => ({
    type,
    label: keywords.find((k) => k.event_type === type)?.label_vi || type,
    items: keywords.filter((k) => k.event_type === type),
  }))

  return (
    <div className="p-6 space-y-4 fade-in">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Quản lý từ khoá sự kiện</h2>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Từ điển cụm từ dùng để nhận diện sự kiện tài chính trong tin tức — chỉnh sửa tại đây sẽ áp dụng ngay ở lần phân tích tiếp theo
        </p>
      </div>

      <form onSubmit={handleCreate} className="section-card flex flex-wrap items-end gap-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>Loại sự kiện (event_type)</label>
          <input className="field-input" list="event-type-options" placeholder="vd: profit_growth" value={form.event_type} onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value }))} required />
          <datalist id="event-type-options">
            {eventTypes.map((t) => <option key={t} value={t} />)}
          </datalist>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>Nhãn tiếng Việt</label>
          <input className="field-input" placeholder="vd: Lợi nhuận/doanh thu tăng" value={form.label_vi} onChange={(e) => setForm((f) => ({ ...f, label_vi: e.target.value }))} />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>Cụm từ khoá</label>
          <input className="field-input" placeholder="vd: lãi kỷ lục" value={form.keyword} onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value }))} required />
        </div>
        <button type="submit" className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium text-white" style={{ background: 'linear-gradient(135deg, #047857, #10b981)' }}>
          <Plus size={14} /> Thêm
        </button>
      </form>

      {loading ? (
        <SkeletonBlock className="h-64" />
      ) : (
        <div className="space-y-4">
          {grouped.map((g) => (
            <div key={g.type} className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <p className="font-semibold text-[13px] mb-3" style={{ color: 'var(--text-primary)' }}>{g.label} <span className="text-[11px] font-normal" style={{ color: 'var(--text-faint)' }}>({g.type})</span></p>
              <div className="flex flex-wrap gap-2">
                {g.items.map((kw) => (
                  <div
                    key={kw.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px]"
                    style={{
                      background: kw.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
                      border: `1px solid ${kw.is_active ? 'rgba(16,185,129,0.25)' : 'rgba(100,116,139,0.2)'}`,
                      color: kw.is_active ? '#34d399' : 'var(--text-muted)',
                    }}
                  >
                    <span>{kw.keyword}</span>
                    <button onClick={() => toggleActive(kw)} title={kw.is_active ? 'Tắt' : 'Bật'}>
                      <Power size={12} />
                    </button>
                    <button onClick={() => handleDelete(kw.id)} title="Xoá" style={{ color: '#f87171' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
