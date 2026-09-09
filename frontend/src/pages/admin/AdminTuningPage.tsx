import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Info, Plus, Power, Save, Trash2 } from 'lucide-react'
import adminApi from '../../services/adminApi'
import type { EventKeyword, SystemSetting } from '../../types'
import { SkeletonBlock } from '../../components/Admin/AdminWidgets'

type Tab = 'thresholds' | 'keywords'

/** Giải thích tác dụng thật của từng ngưỡng.
 *
 * Bản trước chỉ hiện tên khoá kỹ thuật (`manual_review_confidence_threshold`)
 * và một câu mô tả, nên admin không biết đổi nó thì cái gì thay đổi ở đâu.
 */
const SETTING_HELP: Record<string, { title: string; effect: string; link?: { to: string; label: string } }> = {
  sentiment_positive_threshold: {
    title: 'Khi nào coi là tin tốt',
    effect:
      'Bài phải có đủ tỉ lệ từ ngữ mang nghĩa tích cực thì mới được xếp là tin tốt. Đặt cao hơn thì ít bài được coi là tin tốt hơn.',
  },
  sentiment_negative_threshold: {
    title: 'Khi nào coi là tin xấu',
    effect:
      'Dưới tỉ lệ này thì bài được xếp là tin xấu. Đặt thấp hơn thì ít bài bị coi là tin xấu. Khoảng ở giữa là tin trung tính.',
  },
  manual_review_confidence_threshold: {
    title: 'Khi nào cần người xem lại',
    effect:
      'Bài mà hệ thống kém chắc chắn hơn mức này sẽ được xếp vào hàng chờ để người đọc lại. Đặt quá cao thì mọi bài đều vào hàng chờ và việc lọc mất tác dụng — hệ thống hiếm khi chắc chắn hơn 0,45.',
    link: { to: '/admin/labeling', label: 'Xem hàng chờ' },
  },
}

/** Cấu hình phân tích — gộp hai trang cũ.
 *
 * `/admin/settings` (ngưỡng) và `/admin/keywords` (từ khoá sự kiện) là hai
 * trang riêng nhưng làm cùng một việc: thay đổi cách hệ thống diễn giải bài
 * báo. Cả hai đều tác động tới cùng một chỗ — hàng chờ gán nhãn và kết quả
 * kiểm định — nhưng không trang nào nói ra điều đó.
 */
export default function AdminTuningPage() {
  const [tab, setTab] = useState<Tab>('thresholds')

  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)

  const [keywords, setKeywords] = useState<EventKeyword[]>([])
  const [keywordsLoading, setKeywordsLoading] = useState(false)
  const [form, setForm] = useState({ event_type: '', label_vi: '', keyword: '' })
  const [pendingDelete, setPendingDelete] = useState<EventKeyword | null>(null)

  useEffect(() => {
    adminApi.settings
      .list()
      .then((r) => {
        setSettings(r.data)
        const initial: Record<string, string> = {}
        for (const s of r.data as SystemSetting[]) initial[s.key] = s.value
        setDrafts(initial)
      })
      .finally(() => setSettingsLoading(false))
  }, [])

  const loadKeywords = () => {
    setKeywordsLoading(true)
    adminApi.keywords
      .list()
      .then((r) => setKeywords(r.data))
      .finally(() => setKeywordsLoading(false))
  }

  useEffect(() => {
    if (tab === 'keywords' && keywords.length === 0) loadKeywords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const saveSetting = async (key: string) => {
    setSavingKey(key)
    try {
      await adminApi.settings.update(key, drafts[key])
      toast.success('Đã lưu — áp dụng từ bài tiếp theo')
    } catch {
      toast.error('Lỗi khi lưu cấu hình')
    } finally {
      setSavingKey(null)
    }
  }

  const createKeyword = async (e: React.FormEvent) => {
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
      loadKeywords()
    } catch {
      toast.error('Lỗi khi thêm từ khoá')
    }
  }

  const toggleActive = async (kw: EventKeyword) => {
    try {
      await adminApi.keywords.update(kw.id, { is_active: !kw.is_active })
      loadKeywords()
    } catch {
      toast.error('Không đổi được trạng thái từ khoá')
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    const id = pendingDelete.id
    setPendingDelete(null)
    try {
      await adminApi.keywords.delete(id)
      toast.success('Đã xoá từ khoá')
      loadKeywords()
    } catch {
      toast.error('Lỗi khi xoá từ khoá')
    }
  }

  const eventTypes = Array.from(new Set(keywords.map((k) => k.event_type)))
  const grouped = eventTypes.map((type) => ({
    type,
    label: keywords.find((k) => k.event_type === type)?.label_vi || type,
    items: keywords.filter((k) => k.event_type === type),
  }))

  return (
    <div className="p-4 sm:p-6 space-y-4 fade-in">
      <div>
        <h2 className="text-lg sm:text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Cấu hình phân tích
        </h2>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Chỉnh cách hệ thống đọc hiểu bài báo — áp dụng ngay từ bài phân tích tiếp theo
        </p>
      </div>

      <div
        className="rounded-2xl p-3.5 flex items-start gap-2.5"
        style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)' }}
      >
        <Info size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#2563eb' }} />
        <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          Các mục ở đây <strong>không</strong> làm thay đổi phần dự đoán giá — phần đó đã được
          xây và kiểm chứng sẵn, không chỉnh được từ đây. Chúng chỉ ảnh hưởng cách hệ thống
          nhận ra tin tốt/xấu, loại sự việc, và bài nào cần người xem lại. Kết quả thấy ở{' '}
          <Link to="/admin/quality" className="hover:underline" style={{ color: '#2563eb' }}>
            Chất lượng dữ liệu
          </Link>
          .
        </p>
      </div>

      <div className="flex gap-1" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        {([
          { key: 'thresholds', label: 'Mức nhạy khi đọc bài', count: settings.length },
          { key: 'keywords', label: 'Từ ngữ nhận diện sự việc', count: keywords.length || undefined },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-3.5 py-2.5 text-[13px] transition-colors"
            style={{
              color: tab === t.key ? '#2563eb' : 'var(--text-muted)',
              fontWeight: tab === t.key ? 600 : 400,
              borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {t.label}
            {t.count != null && <span className="ml-1.5 text-[11px] tabular-nums opacity-70">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'thresholds' ? (
        settingsLoading ? (
          <SkeletonBlock className="h-64" />
        ) : (
          <div className="space-y-3">
            {settings.map((s) => {
              const help = SETTING_HELP[s.key]
              return (
                <div
                  key={s.key}
                  className="section-card"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex-1 min-w-[240px]">
                      <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {help?.title || s.key}
                      </p>
                      <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--text-faint)' }}>
                        {s.key}
                      </p>
                      <p className="text-[12px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                        {help?.effect || s.description}
                      </p>
                      {help?.link && (
                        <Link
                          to={help.link.to}
                          className="text-[11px] hover:underline inline-block mt-1"
                          style={{ color: '#2563eb' }}
                        >
                          {help.link.label} →
                        </Link>
                      )}
                    </div>
                    <div className="flex items-end gap-2">
                      <input
                        className="field-input w-28"
                        value={drafts[s.key] ?? ''}
                        onChange={(e) => setDrafts((d) => ({ ...d, [s.key]: e.target.value }))}
                        aria-label={help?.title || s.key}
                      />
                      <button
                        onClick={() => saveSetting(s.key)}
                        disabled={savingKey === s.key || drafts[s.key] === s.value}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium text-white disabled:opacity-40"
                        style={{ background: 'linear-gradient(135deg, #047857, #10b981)' }}
                      >
                        <Save size={13} /> Lưu
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        <>
          <form
            onSubmit={createKeyword}
            className="section-card flex flex-wrap items-end gap-3"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[11px] mb-1" style={{ color: 'var(--text-muted)' }} htmlFor="kw-type">
                Loại sự việc
              </label>
              <input
                id="kw-type"
                className="field-input"
                list="event-type-options"
                placeholder="vd: profit_growth"
                value={form.event_type}
                onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value }))}
                required
              />
              <datalist id="event-type-options">
                {eventTypes.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[11px] mb-1" style={{ color: 'var(--text-muted)' }} htmlFor="kw-label">
                Tên hiển thị
              </label>
              <input
                id="kw-label"
                className="field-input"
                placeholder="vd: Lợi nhuận tăng"
                value={form.label_vi}
                onChange={(e) => setForm((f) => ({ ...f, label_vi: e.target.value }))}
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[11px] mb-1" style={{ color: 'var(--text-muted)' }} htmlFor="kw-word">
                Cụm từ trong bài
              </label>
              <input
                id="kw-word"
                className="field-input"
                placeholder="vd: lãi kỷ lục"
                value={form.keyword}
                onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value }))}
                required
              />
            </div>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #047857, #10b981)' }}
            >
              <Plus size={13} /> Thêm
            </button>
          </form>

          {keywordsLoading ? (
            <SkeletonBlock className="h-64" />
          ) : (
            <div className="space-y-3">
              {grouped.map((g) => (
                <div
                  key={g.type}
                  className="section-card"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  <div className="flex items-baseline gap-2 mb-2.5">
                    <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {g.label}
                    </h3>
                    <span className="text-[11px] font-mono" style={{ color: 'var(--text-faint)' }}>
                      {g.type}
                    </span>
                    <span className="text-[11px] ml-auto tabular-nums" style={{ color: 'var(--text-faint)' }}>
                      {g.items.filter((k) => k.is_active).length}/{g.items.length} đang bật
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.items.map((kw) => (
                      <span
                        key={kw.id}
                        className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg"
                        style={{
                          background: kw.is_active ? 'rgba(37,99,235,0.10)' : 'var(--bg-surface)',
                          color: kw.is_active ? '#2563eb' : 'var(--text-faint)',
                          border: '1px solid var(--border-subtle)',
                          textDecoration: kw.is_active ? 'none' : 'line-through',
                        }}
                      >
                        {kw.keyword}
                        <button
                          onClick={() => toggleActive(kw)}
                          aria-label={kw.is_active ? `Tắt từ khoá ${kw.keyword}` : `Bật từ khoá ${kw.keyword}`}
                          title={kw.is_active ? 'Tắt' : 'Bật'}
                        >
                          <Power size={10} />
                        </button>
                        <button
                          onClick={() => setPendingDelete(kw)}
                          aria-label={`Xoá từ khoá ${kw.keyword}`}
                          title="Xoá"
                          style={{ color: '#ef4444' }}
                        >
                          <Trash2 size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.5)' }}
          role="dialog"
          aria-modal="true"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              Xoá từ khoá “{pendingDelete.keyword}”?
            </h3>
            <p className="text-[12px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Các bài đọc sau này sẽ không còn dựa vào cụm từ này nữa. Bài đã đọc trước đó giữ
              nguyên kết quả cũ.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 rounded-xl text-[13px]"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                Huỷ
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl text-[13px] font-medium text-white"
                style={{ background: '#dc2626' }}
              >
                Xoá
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
