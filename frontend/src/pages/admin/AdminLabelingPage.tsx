import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { CheckCircle2 } from 'lucide-react'
import adminApi from '../../services/adminApi'
import type { NewsArticle } from '../../types'
import { SkeletonBlock } from '../../components/Admin/AdminWidgets'

const SENTIMENT_OPTIONS = ['Positive', 'Negative', 'Neutral']
const EVENT_TYPE_OPTIONS = [
  'profit_growth', 'profit_decline', 'dividend', 'merger', 'new_contract',
  'penalty', 'leadership_change', 'share_issuance', 'expansion',
]

export default function AdminLabelingPage() {
  const [queue, setQueue] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<number, { manual_sentiment: string; manual_event_type: string }>>({})

  const load = () => {
    setLoading(true)
    adminApi.labeling
      .queue()
      .then((r) => {
        setQueue(r.data)
        const initial: Record<number, { manual_sentiment: string; manual_event_type: string }> = {}
        for (const n of r.data as NewsArticle[]) {
          initial[n.id] = { manual_sentiment: n.sentiment || '', manual_event_type: (n.events_detected || [])[0] || '' }
        }
        setDrafts(initial)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const submit = async (id: number) => {
    const draft = drafts[id]
    if (!draft) return
    try {
      await adminApi.labeling.submit(id, draft)
      toast.success('Đã gán nhãn')
      setQueue((q) => q.filter((n) => n.id !== id))
    } catch {
      toast.error('Lỗi khi gán nhãn')
    }
  }

  return (
    <div className="p-6 space-y-4 fade-in">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Gán nhãn thủ công</h2>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {queue.length} mẫu đang chờ gán nhãn (độ tin cậy dự đoán thấp hơn ngưỡng cấu hình)
        </p>
      </div>

      {loading ? (
        <SkeletonBlock className="h-64" />
      ) : queue.length === 0 ? (
        <div className="section-card flex items-center gap-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>Không còn mẫu nào cần gán nhãn thủ công</span>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((n) => (
            <div key={n.id} className="section-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-[13px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
              <p className="text-[11px] mb-3" style={{ color: 'var(--text-faint)' }}>
                Dự đoán tự động: sentiment={n.sentiment || '—'} · độ tin cậy={n.prediction_confidence != null ? `${Math.round(n.prediction_confidence * 100)}%` : '—'}
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>Sentiment đúng</label>
                  <select
                    className="field-input w-40"
                    value={drafts[n.id]?.manual_sentiment || ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [n.id]: { ...d[n.id], manual_sentiment: e.target.value } }))}
                  >
                    <option value="">— Chọn —</option>
                    {SENTIMENT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>Sự kiện đúng</label>
                  <select
                    className="field-input w-48"
                    value={drafts[n.id]?.manual_event_type || ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [n.id]: { ...d[n.id], manual_event_type: e.target.value } }))}
                  >
                    <option value="">— Không có —</option>
                    {EVENT_TYPE_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <button
                  onClick={() => submit(n.id)}
                  className="px-4 py-2 rounded-xl text-[13px] font-medium text-white"
                  style={{ background: 'linear-gradient(135deg, #047857, #10b981)' }}
                >
                  Xác nhận nhãn
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
