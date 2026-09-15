import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { CheckCircle2, Eye, EyeOff, Info, ShieldCheck, Sliders } from 'lucide-react'
import adminApi from '../../services/adminApi'
import type { NewsArticle } from '../../types'
import { SkeletonBlock } from '../../components/Admin/AdminWidgets'
import { useLanguage } from '../../context/LanguageContext'

const SENTIMENT_OPTIONS = ['Positive', 'Negative', 'Neutral']

// Danh sách này phải khớp EVENT_PATTERNS ở backend. Lấy động từ API quản trị
// từ khoá thay vì chép cứng, để loại sự kiện admin tự thêm cũng xuất hiện ở
// đây — bản trước hard-code 9 giá trị nên loại mới không bao giờ gán được.
const FALLBACK_EVENT_TYPES = [
  'profit_growth', 'profit_decline', 'dividend', 'merger', 'new_contract',
  'penalty', 'leadership_change', 'share_issuance', 'expansion',
]

interface Draft {
  manual_sentiment: string
  manual_event_type: string
}

export default function AdminLabelingPage() {
  const { t } = useLanguage()
  const [queue, setQueue] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const [eventTypes, setEventTypes] = useState<string[]>(FALLBACK_EVENT_TYPES)
  // Dự đoán của mô hình bị ẩn mặc định. Người gán nhãn phải quyết định trước,
  // rồi mới được xem máy nói gì.
  const [revealed, setRevealed] = useState<Record<number, boolean>>({})

  const load = () => {
    setLoading(true)
    adminApi.labeling
      .queue()
      .then((r) => {
        setQueue(r.data)
        // Ô nhãn để TRỐNG.
        //
        // Bản trước khởi tạo chúng bằng chính đầu ra của mô hình
        // (`n.sentiment` và `n.events_detected[0]`) và in dự đoán ngay phía
        // trên. Người gán nhãn chỉ cần bấm "Xác nhận" là nhãn của máy được
        // ghi lại thành "ground truth" của người. Điều đó làm mọi chỉ số đo
        // sau đó thành vòng tròn: accuracy_event đo được 100% chỉ vì giá trị
        // so sánh đã được mồi từ chính thứ đem ra so.
        const initial: Record<number, Draft> = {}
        for (const n of r.data as NewsArticle[]) {
          initial[n.id] = { manual_sentiment: '', manual_event_type: '' }
        }
        setDrafts(initial)
        setRevealed({})
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  useEffect(() => {
    adminApi.keywords
      .list()
      .then((r) => {
        const types = Array.from(
          new Set((r.data as { event_type: string }[]).map((k) => k.event_type)),
        )
        if (types.length) setEventTypes(types)
      })
      .catch(() => setEventTypes(FALLBACK_EVENT_TYPES))
  }, [])

  const submit = async (id: number) => {
    const draft = drafts[id]
    if (!draft?.manual_sentiment) {
      toast.error(t('adminLabeling.toastNeedSentiment'))
      return
    }
    try {
      await adminApi.labeling.submit(id, draft)
      toast.success(t('adminLabeling.toastSubmitSuccess'))
      setQueue((q) => q.filter((n) => n.id !== id))
    } catch {
      toast.error(t('adminLabeling.toastSubmitError'))
    }
  }

  const skip = (id: number) => {
    setQueue((q) => q.filter((n) => n.id !== id))
    toast(t('adminLabeling.toastSkipped'), { icon: '↷' })
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 fade-in">
      <div>
        <h2 className="text-lg sm:text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('adminLabeling.pageTitle')}
        </h2>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {t('adminLabeling.pageSubtitle', { count: queue.length })}
        </p>
      </div>

      <div
        className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)' }}
      >
        <Info size={15} className="mt-0.5 flex-shrink-0" style={{ color: '#2563eb' }} />
        <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('adminLabeling.infoBoxBold')}
          </p>
          <p className="mt-1">
            {t('adminLabeling.infoBoxBefore')}{' '}
            <Link to="/admin/quality" className="underline" style={{ color: '#2563eb' }}>
              {t('adminLabeling.infoBoxLinkText')}
            </Link>
            {t('adminLabeling.infoBoxAfter')}
          </p>
        </div>
      </div>

      {loading ? (
        <SkeletonBlock className="h-64" />
      ) : queue.length === 0 ? (
        <div
          className="section-card"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              {t('adminLabeling.emptyQueue')}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Link
              to="/admin/quality"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px]"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              <ShieldCheck size={12} /> {t('adminLabeling.viewConfirmedResults')}
            </Link>
            <Link
              to="/admin/tuning"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px]"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              <Sliders size={12} /> {t('adminLabeling.tuneQueueSensitivity')}
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((n) => (
            <div
              key={n.id}
              className="section-card"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <p className="text-[13px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                {n.title}
              </p>
              {n.content && (
                <p className="text-[12px] mb-3 line-clamp-3" style={{ color: 'var(--text-muted)' }}>
                  {n.content}
                </p>
              )}

              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label
                    className="block text-[11px] mb-1"
                    style={{ color: 'var(--text-muted)' }}
                    htmlFor={`sent-${n.id}`}
                  >
                    {t('adminLabeling.sentimentQuestionLabel')}
                  </label>
                  <select
                    id={`sent-${n.id}`}
                    className="field-input w-40"
                    value={drafts[n.id]?.manual_sentiment || ''}
                    onChange={(e) =>
                      setDrafts((d) => ({
                        ...d,
                        [n.id]: { ...d[n.id], manual_sentiment: e.target.value },
                      }))
                    }
                  >
                    <option value="">{t('adminLabeling.chooseOption')}</option>
                    {SENTIMENT_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    className="block text-[11px] mb-1"
                    style={{ color: 'var(--text-muted)' }}
                    htmlFor={`event-${n.id}`}
                  >
                    {t('adminLabeling.eventQuestionLabel')}
                  </label>
                  <select
                    id={`event-${n.id}`}
                    className="field-input w-48"
                    value={drafts[n.id]?.manual_event_type || ''}
                    onChange={(e) =>
                      setDrafts((d) => ({
                        ...d,
                        [n.id]: { ...d[n.id], manual_event_type: e.target.value },
                      }))
                    }
                  >
                    <option value="">{t('adminLabeling.noneOption')}</option>
                    {eventTypes.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => submit(n.id)}
                  className="px-4 py-2 rounded-xl text-[13px] font-medium text-white"
                  style={{ background: 'linear-gradient(135deg, #047857, #10b981)' }}
                >
                  {t('adminLabeling.confirmButton')}
                </button>

                <button
                  onClick={() => skip(n.id)}
                  className="px-4 py-2 rounded-xl text-[13px]"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {t('adminLabeling.skipButton')}
                </button>
              </div>

              {/* Dự đoán của máy: có thể xem, nhưng phải chủ động mở, và chỉ
                  sau khi đã có nhãn của người thì nút mới hết ý nghĩa gợi ý. */}
              <div className="mt-3 pt-3" style={{ borderTop: '1px dashed var(--border-subtle)' }}>
                <button
                  onClick={() => setRevealed((r) => ({ ...r, [n.id]: !r[n.id] }))}
                  className="inline-flex items-center gap-1.5 text-[11px]"
                  style={{ color: 'var(--text-faint)' }}
                >
                  {revealed[n.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                  {revealed[n.id] ? t('adminLabeling.hideMachineAnswer') : t('adminLabeling.showMachineAnswer')}
                </button>
                {revealed[n.id] && (
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('adminLabeling.machineReadPrefix')} <strong>{n.sentiment || '—'}</strong> {t('adminLabeling.machinePredictedPrice')}{' '}
                    <strong>{n.predicted_trend || t('adminLabeling.noAnswer')}</strong> {t('adminLabeling.machineConfidence')}{' '}
                    <strong>
                      {n.prediction_confidence != null
                        ? `${Math.round(n.prediction_confidence * 100)}%`
                        : '—'}
                    </strong>
                    {n.prediction_decision ? ` · ${n.prediction_decision}` : ''}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
