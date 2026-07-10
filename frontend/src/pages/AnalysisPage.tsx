import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { newsApi } from '../services/api'
import type { NewsArticle } from '../types'
import { RefreshCw, Trash2, ChevronDown, ChevronUp, Search, Loader2, Upload } from 'lucide-react'

const SENTIMENT_STYLE: Record<string, { badge: string; dot: string }> = {
  Positive: { badge: 'badge-up', dot: '#10b981' },
  Negative: { badge: 'badge-down', dot: '#ef4444' },
  Neutral: { badge: 'badge-neutral', dot: '#64748b' },
}
const TREND_LABEL: Record<string, string> = {
  INCREASING: '↑ Tăng',
  DECREASING: '↓ Giảm',
  UNCHANGED: '— Ổn định',
}
const TREND_COLOR: Record<string, string> = {
  INCREASING: '#10b981',
  DECREASING: '#ef4444',
  UNCHANGED: '#64748b',
}

function NewsCard({ news, onDelete }: { news: NewsArticle; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const sentStyle = news.sentiment ? SENTIMENT_STYLE[news.sentiment] : null
  const confidence = Math.round((news.prediction_confidence || 0) * 100)

  return (
    <div
      className="rounded-2xl overflow-hidden mb-3 transition-all duration-200"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        style={{ transition: 'background 0.15s' }}
        onClick={() => setExpanded(e => !e)}
        onMouseEnter={e => {
          ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(37,99,235,0.04)'
        }}
        onMouseLeave={e => {
          ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
        }}
      >
        {/* Sentiment dot */}
        <div
          className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
          style={{
            background: sentStyle?.dot || (news.is_analyzed ? '#64748b' : '#f59e0b'),
            boxShadow: sentStyle?.dot ? `0 0 6px ${sentStyle.dot}60` : undefined,
          }}
        />

        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium leading-snug line-clamp-2" style={{ color: 'var(--text-primary)' }}>{news.title}</p>
          <div className="flex items-center flex-wrap gap-2 mt-1.5">
            <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
              {news.source || '—'} · {news.published_date || '—'}
            </span>

            {news.is_analyzed ? (
              <>
                {news.sentiment && sentStyle && (
                  <span className={`${sentStyle.badge} text-[10px] px-2 py-0.5 rounded-full font-medium`}>
                    {news.sentiment}
                  </span>
                )}
                {news.predicted_trend && (
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: TREND_COLOR[news.predicted_trend] || '#64748b' }}
                  >
                    {TREND_LABEL[news.predicted_trend]} {confidence > 0 && `(${confidence}%)`}
                  </span>
                )}
                {news.stocks_mentioned?.length > 0 && (
                  <div className="flex gap-1">
                    {news.stocks_mentioned.slice(0, 3).map(s => (
                      <span key={s} className="badge-up text-[10px] px-1.5 py-0.5 rounded font-medium">
                        {s}
                      </span>
                    ))}
                    {news.stocks_mentioned.length > 3 && (
                      <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                        +{news.stocks_mentioned.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <span className="badge-amber text-[10px] px-2 py-0.5 rounded-full">Chờ phân tích</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
          <button
            onClick={e => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-faint)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            <Trash2 size={13} />
          </button>
          <div style={{ color: 'var(--text-faint)' }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>
      </div>

      {expanded && news.is_analyzed && (
        <div
          className="px-4 pb-4 pt-3 grid grid-cols-2 md:grid-cols-3 gap-4"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-faint)' }}>
              Mã cổ phiếu
            </p>
            <div className="flex flex-wrap gap-1">
              {news.stocks_mentioned.length > 0
                ? news.stocks_mentioned.map(s => (
                    <span key={s} className="badge-up text-[11px] px-2 py-0.5 rounded font-medium">{s}</span>
                  ))
                : <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Không tìm thấy</span>}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-faint)' }}>
              Ngành nghề
            </p>
            <div className="flex flex-wrap gap-1">
              {news.industries_mentioned.map(i => (
                <span key={i} className="badge-amber text-[11px] px-2 py-0.5 rounded">{i}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-faint)' }}>
              Sự kiện
            </p>
            <div className="flex flex-wrap gap-1">
              {news.events_detected.map(ev => (
                <span key={ev} className="badge-down text-[11px] px-2 py-0.5 rounded">
                  {ev.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-faint)' }}>
              Impact Score
            </p>
            <div className="flex items-baseline gap-1">
              <span className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{news.impact_score?.toFixed(0)}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>/100</span>
            </div>
          </div>
          {news.prediction_explanation && (news.prediction_explanation as { reasons?: string[] }).reasons && (
            <div className="col-span-2">
              <p className="text-[10px] font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-faint)' }}>
                Lý do dự đoán
              </p>
              <ul className="space-y-0.5">
                {((news.prediction_explanation as { reasons: string[] }).reasons).map((r, i) => (
                  <li key={i} className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                    · {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AnalysisPage() {
  const [news, setNews] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'analyzed' | 'pending'>('all')
  const [page, setPage] = useState(0)
  const pageSize = 50

  const load = () => {
    setLoading(true)
    newsApi.list({ skip: page * pageSize, limit: pageSize }).then(r => setNews(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [page])

  const handleDelete = async (id: number) => {
    await newsApi.delete(id)
    toast.success('Đã xoá bài báo')
    setNews(prev => prev.filter(n => n.id !== id))
  }

  const filtered = news.filter(n => {
    if (filter === 'analyzed' && !n.is_analyzed) return false
    if (filter === 'pending' && n.is_analyzed) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        n.title.toLowerCase().includes(q) ||
        n.stocks_mentioned.some(s => s.toLowerCase().includes(q)) ||
        (n.source || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const analyzed = news.filter(n => n.is_analyzed).length
  const pending = news.length - analyzed

  return (
    <div className="p-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Tin tức</h2>
          {!loading && news.length > 0 && (
            <div className="flex items-center gap-3 mt-1.5">
              <span className="badge-blue text-[11px] px-2 py-0.5 rounded-full">{news.length} bài báo trên trang này</span>
              <span className="badge-up text-[11px] px-2 py-0.5 rounded-full">{analyzed} đã phân tích</span>
              {pending > 0 && (
                <span className="badge-amber text-[11px] px-2 py-0.5 rounded-full">{pending} chờ xử lý</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/import"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)', color: 'white' }}
          >
            <Upload size={13} />
            Nhập dữ liệu
          </Link>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] transition-all"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        className="flex gap-3 mb-5 p-3 rounded-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
          <input
            className="field-input pl-8 h-9 text-[13px]"
            placeholder="Tìm theo tiêu đề, mã cổ phiếu, nguồn..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'analyzed', 'pending'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-[12px] transition-all"
              style={
                filter === f
                  ? { background: 'rgba(37,99,235,0.2)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.3)' }
                  : { color: 'var(--text-muted)', border: '1px solid transparent' }
              }
            >
              {f === 'all' ? 'Tất cả' : f === 'analyzed' ? 'Đã phân tích' : 'Chờ xử lý'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-2xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <Loader2 size={32} style={{ color: 'var(--border-default)' }} className="mb-3" />
          <p className="text-[14px] font-medium" style={{ color: 'var(--text-muted)' }}>
            {news.length === 0 ? 'Chưa có tin tức nào' : 'Không tìm thấy kết quả'}
          </p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-faint)' }}>
            {news.length === 0 ? 'Hãy import dữ liệu trước' : 'Thử tìm kiếm khác'}
          </p>
        </div>
      ) : (
        <div>
          {filtered.map(n => (
            <NewsCard key={n.id} news={n} onDelete={() => handleDelete(n.id)} />
          ))}
        </div>
      )}

      {!loading && news.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <button
            disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
            className="px-3 py-1.5 rounded-lg text-[12px] disabled:opacity-40"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            ← Trang trước
          </button>
          <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>Trang {page + 1}</span>
          <button
            disabled={news.length < pageSize}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 rounded-lg text-[12px] disabled:opacity-40"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            Trang sau →
          </button>
        </div>
      )}
    </div>
  )
}
