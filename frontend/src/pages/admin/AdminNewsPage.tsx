import { Fragment, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Plus,
  Upload,
  RefreshCw,
  Trash2,
  Pencil,
  Check,
  X,
  Search,
  Link2,
  Globe,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react'
import { newsApi } from '../../services/api'
import type { NewsArticle } from '../../types'
import { SentimentBadge, StatusBadge } from '../../components/Admin/AdminWidgets'
import { contentPreviewParagraphs } from '../../utils/articleContent'
import { useLanguage } from '../../context/LanguageContext'

const SENTIMENT_OPTIONS = ['Positive', 'Negative', 'Neutral']

type ImportTab = 'manual' | 'csv' | 'url'

/** Trích đoạn gốc + link đọc bài gốc — cùng tính năng đang có ở thẻ tin phía
 *  khách hàng (NewsCard), gắn thêm vào đây vì admin cũng nhập/duyệt tin ở
 *  trang này và cần thấy được đúng như vậy, không phải bảng dữ liệu thô.
 *  Không có mục tóm tắt AI: tốn API Claude thật mỗi lần tạo, không kiểm soát
 *  được chi phí khi có nhiều người dùng. */
function NewsDetailPanel({ news }: { news: NewsArticle }) {
  const { t } = useLanguage()
  const preview = news.content ? contentPreviewParagraphs(news.content) : null
  return (
    <div className="space-y-3 max-w-3xl">
      {preview && preview.paragraphs.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-faint)' }}>
            {t('adminNews.excerptTitle')}
          </p>
          <div className="space-y-2">
            {preview.paragraphs.map((para, i) => (
              <p key={i} className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {para}
              </p>
            ))}
          </div>
        </div>
      )}

      {news.url && (
        <a
          href={news.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] hover:underline"
          style={{ color: '#2563eb' }}
        >
          <ExternalLink size={11} /> {t('adminNews.readOriginal')}
        </a>
      )}
    </div>
  )
}

export default function AdminNewsPage() {
  const { t } = useLanguage()
  const IMPORT_TABS: { key: ImportTab; icon: React.ElementType; label: string }[] = [
    { key: 'manual', icon: Plus, label: t('adminNews.tabManual') },
    { key: 'csv', icon: Upload, label: t('adminNews.tabCsv') },
    { key: 'url', icon: Link2, label: t('adminNews.tabUrl') },
  ]
  const [news, setNews] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [sentiment, setSentiment] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 20

  const [showImport, setShowImport] = useState(false)
  const [importTab, setImportTab] = useState<ImportTab>('manual')
  const [form, setForm] = useState({ title: '', content: '', source: '', published_date: '' })
  const [urlInput, setUrlInput] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ title: '', source: '', sentiment: '' })
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    newsApi
      .list({
        skip: page * pageSize,
        limit: pageSize,
        q: q || undefined,
        sentiment: sentiment || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      })
      .then((r) => setNews(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [page])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(0)
    load()
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    try {
      await newsApi.create(form)
      toast.success(t('adminNews.toastCreateSuccess'))
      setForm({ title: '', content: '', source: '', published_date: '' })
      setShowImport(false)
      load()
    } catch {
      toast.error(t('adminNews.toastCreateError'))
    }
  }

  const handleUploadCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const res = await newsApi.uploadCsv(file)
      toast.success(t('adminNews.toastCsvSuccess', { count: res.data.ids.length }))
      load()
    } catch {
      toast.error(t('adminNews.toastCsvError'))
    } finally {
      e.target.value = ''
    }
  }

  const handleUrlImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!urlInput.trim()) return
    setUrlLoading(true)
    try {
      await newsApi.importUrl(urlInput.trim())
      toast.success(t('adminNews.toastUrlSuccess'))
      setUrlInput('')
      load()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        t('adminNews.toastUrlError')
      toast.error(msg)
    } finally {
      setUrlLoading(false)
    }
  }

  const handleAnalyze = async (id: number) => {
    await newsApi.analyze(id)
    toast.success(t('adminNews.toastAnalyzeSuccess'))
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('adminNews.confirmDelete'))) return
    await newsApi.delete(id)
    toast.success(t('adminNews.toastDeleteSuccess'))
    load()
  }

  const startEdit = (n: NewsArticle) => {
    setEditingId(n.id)
    setEditForm({ title: n.title, source: n.source || '', sentiment: n.sentiment || '' })
  }

  const saveEdit = async (id: number) => {
    try {
      await newsApi.patch(id, editForm)
      toast.success(t('adminNews.toastUpdateSuccess'))
      setEditingId(null)
      load()
    } catch {
      toast.error(t('adminNews.toastUpdateError'))
    }
  }

  return (
    <div className="p-6 space-y-4 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('adminNews.pageTitle')}</h2>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('adminNews.pageSubtitle', { count: news.length })}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #047857, #10b981)' }}
          >
            <Plus size={14} /> {t('adminNews.addImportButton')}
          </button>
        </div>
      </div>

      {showImport && (
        <div className="section-card space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            {IMPORT_TABS.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setImportTab(key)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-all"
                style={
                  importTab === key
                    ? { background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }
                    : { border: '1px solid transparent', color: 'var(--text-muted)' }
                }
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          {importTab === 'manual' && (
            <form onSubmit={handleCreate} className="space-y-3">
              <input className="field-input" placeholder={t('adminNews.placeholderTitle')} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
              <textarea className="field-input resize-none" rows={3} placeholder={t('adminNews.placeholderContent')} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <input className="field-input" placeholder={t('adminNews.placeholderSource')} value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />
                <input type="date" className="field-input" value={form.published_date} onChange={(e) => setForm((f) => ({ ...f, published_date: e.target.value }))} />
              </div>
              <button type="submit" className="px-5 py-2 rounded-xl text-[13px] font-medium text-white" style={{ background: 'linear-gradient(135deg, #047857, #10b981)' }}>
                {t('adminNews.saveArticleButton')}
              </button>
            </form>
          )}

          {importTab === 'csv' && (
            <div className="space-y-3">
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                {t('adminNews.csvHintBefore')} <strong>{t('adminNews.csvHintField')}</strong> {t('adminNews.csvHintAfter')}
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: '#cbd5e1' }}
              >
                <Upload size={14} /> {t('adminNews.chooseCsvFile')}
              </button>
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleUploadCsv} />
            </div>
          )}

          {importTab === 'url' && (
            <form onSubmit={handleUrlImport} className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
                  <input
                    className="field-input pl-9"
                    placeholder="https://cafef.vn/..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    type="url"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={urlLoading || !urlInput.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-medium text-white disabled:opacity-50 flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #047857, #10b981)' }}
                >
                  {urlLoading ? (
                    <><Loader2 size={14} className="animate-spin" /> {t('adminNews.urlImporting')}</>
                  ) : (
                    <><Globe size={14} /> {t('adminNews.urlImportButton')}</>
                  )}
                </button>
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                {t('adminNews.urlSupportedSites')}
              </p>
            </form>
          )}
        </div>
      )}

      <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
          <input className="field-input pl-9" placeholder={t('adminNews.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="field-input w-auto" value={sentiment} onChange={(e) => setSentiment(e.target.value)}>
          <option value="">{t('adminNews.allSentiments')}</option>
          {SENTIMENT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" className="field-input w-auto" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input type="date" className="field-input w-auto" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <button type="submit" className="px-4 py-2 rounded-xl text-[13px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: '#cbd5e1' }}>
          {t('adminNews.filterButton')}
        </button>
      </form>

      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ color: 'var(--text-faint)', borderBottom: '1px solid var(--border-subtle)' }}>
                {[
                  '',
                  t('adminNews.colId'),
                  t('adminNews.colTitle'),
                  t('adminNews.colSource'),
                  t('adminNews.colPublishedDate'),
                  t('adminNews.colStockCode'),
                  t('adminNews.colEvent'),
                  t('adminNews.colSentiment'),
                  t('adminNews.colImpact'),
                  t('adminNews.colStatus'),
                  t('adminNews.colAction'),
                ].map((h, i) => (
                  <th key={h || `col-${i}`} className="text-left font-medium px-3 py-2.5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="text-center py-8" style={{ color: 'var(--text-faint)' }}>{t('adminNews.loadingRow')}</td></tr>
              ) : news.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-8" style={{ color: 'var(--text-faint)' }}>{t('adminNews.noArticles')}</td></tr>
              ) : (
                news.map((n) => (
                  <Fragment key={n.id}>
                  <tr style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => setExpandedId((v) => (v === n.id ? null : n.id))}
                        className="p-1 rounded-md"
                        style={{ color: 'var(--text-faint)' }}
                        title={expandedId === n.id ? t('adminNews.collapse') : t('adminNews.viewOriginalContent')}
                      >
                        {expandedId === n.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </td>
                    <td className="px-3 py-2.5" style={{ color: 'var(--text-muted)' }}>{n.id}</td>
                    <td className="px-3 py-2.5 max-w-[280px]">
                      {editingId === n.id ? (
                        <input className="field-input" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
                      ) : (
                        <div>
                          <span className="line-clamp-2" style={{ color: 'var(--text-primary)' }}>{n.title}</span>
                          {n.url && (
                            <a
                              href={n.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10.5px] hover:underline mt-0.5"
                              style={{ color: '#2563eb' }}
                            >
                              <ExternalLink size={10} /> {t('adminNews.readOriginal')}
                            </a>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5" style={{ color: 'var(--text-secondary)' }}>
                      {editingId === n.id ? (
                        <input className="field-input w-28" value={editForm.source} onChange={(e) => setEditForm((f) => ({ ...f, source: e.target.value }))} />
                      ) : (n.source || '—')}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{n.published_date || '—'}</td>
                    <td className="px-3 py-2.5">{(n.stocks_mentioned || []).join(', ') || '—'}</td>
                    <td className="px-3 py-2.5">{(n.events_detected || []).slice(0, 2).join(', ') || '—'}</td>
                    <td className="px-3 py-2.5">
                      {editingId === n.id ? (
                        <select className="field-input w-28" value={editForm.sentiment} onChange={(e) => setEditForm((f) => ({ ...f, sentiment: e.target.value }))}>
                          <option value="">—</option>
                          {SENTIMENT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <SentimentBadge sentiment={n.sentiment} />
                      )}
                    </td>
                    <td className="px-3 py-2.5" style={{ color: 'var(--text-secondary)' }}>{n.impact_score ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      {n.needs_manual_label ? (
                        <StatusBadge status="REVIEW" />
                      ) : n.is_analyzed ? (
                        <StatusBadge status="PASS" />
                      ) : (
                        <StatusBadge status={t('adminNews.statusPendingAnalysis')} />
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {editingId === n.id ? (
                          <>
                            <button onClick={() => saveEdit(n.id)} className="p-1.5 rounded-lg" style={{ color: '#10b981' }} title={t('adminNews.titleSave')}><Check size={14} /></button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-secondary)' }} title={t('adminNews.titleCancel')}><X size={14} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(n)} className="p-1.5 rounded-lg" style={{ color: '#2dd4bf' }} title={t('adminNews.titleEdit')}><Pencil size={14} /></button>
                            <button onClick={() => handleAnalyze(n.id)} className="p-1.5 rounded-lg" style={{ color: '#fbbf24' }} title={t('adminNews.titleReanalyze')}><RefreshCw size={14} /></button>
                            <button onClick={() => handleDelete(n.id)} className="p-1.5 rounded-lg" style={{ color: '#f87171' }} title={t('adminNews.titleDelete')}><Trash2 size={14} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === n.id && (
                    <tr style={{ borderTop: '1px dashed var(--border-subtle)' }}>
                      <td colSpan={11} className="px-4 py-3" style={{ background: 'var(--bg-surface)' }}>
                        <NewsDetailPanel news={n} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="px-3 py-1.5 rounded-lg text-[12px] disabled:opacity-40" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: '#cbd5e1' }}>
          {t('adminNews.prevPage')}
        </button>
        <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>{t('adminNews.pageIndicator', { page: page + 1 })}</span>
        <button disabled={news.length < pageSize} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg text-[12px] disabled:opacity-40" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: '#cbd5e1' }}>
          {t('adminNews.nextPage')}
        </button>
      </div>
    </div>
  )
}
