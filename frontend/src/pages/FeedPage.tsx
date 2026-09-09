import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AlertTriangle, Filter, Newspaper, RefreshCw, Search, Upload, X } from 'lucide-react'
import { newsApi, type NewsFilters } from '../services/api'
import type { NewsArticle } from '../types'
import { useAuth } from '../context/AuthContext'
import NewsCard from '../components/news/NewsCard'
import { EVENT_LABELS, SENTIMENT_COLORS, SENTIMENT_LABELS, SymbolChip } from '../components/common/Chips'

const PAGE_SIZE = 30

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setDebounced(value), delay)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [value, delay])
  return debounced
}

function FacetGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="pb-3 mb-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <p
        className="text-[10px] font-semibold uppercase tracking-widest mb-2"
        style={{ color: 'var(--text-faint)' }}
      >
        {title}
      </p>
      {children}
    </div>
  )
}

function FacetButton({
  active,
  onClick,
  children,
  count,
  dotColor,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  count?: number
  dotColor?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] text-left transition-colors"
      style={
        active
          ? { background: 'rgba(37,99,235,0.12)', color: '#2563eb', fontWeight: 500 }
          : { color: 'var(--text-secondary)' }
      }
    >
      {dotColor && (
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor }} />
      )}
      <span className="flex-1 truncate">{children}</span>
      {count != null && (
        <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
          {count}
        </span>
      )}
    </button>
  )
}

/** Dòng tin — một nơi duy nhất để đọc và lọc tin đã phân tích.
 *
 * Thay cho ba trang cũ (Tin tức / Sự kiện tài chính / Phân tích cảm xúc) vốn
 * đọc cùng bảng `news_articles` rồi lọc bằng JavaScript ở phía trình duyệt.
 * Bộ lọc ở đây chạy trên server và phản ánh vào URL, nên một góc nhìn đã lọc
 * chia sẻ được và bấm Quay lại vẫn giữ nguyên.
 */
export default function FeedPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [news, setNews] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [pendingDelete, setPendingDelete] = useState<NewsArticle | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const [search, setSearch] = useState(params.get('q') || '')
  const debouncedSearch = useDebounced(search, 350)

  const sentiment = params.get('sentiment') || ''
  const event = params.get('event') || ''
  const stock = params.get('stock') || ''
  const source = params.get('source') || ''
  const isAdmin = user?.role === 'admin'

  const setFacet = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params)
      if (value && next.get(key) !== value) next.set(key, value)
      else next.delete(key)
      setParams(next, { replace: true })
      setPage(0)
    },
    [params, setParams],
  )

  const clearAll = () => {
    setSearch('')
    setParams(new URLSearchParams(), { replace: true })
    setPage(0)
  }

  const filters: NewsFilters = useMemo(
    () => ({
      skip: page * PAGE_SIZE,
      limit: PAGE_SIZE,
      q: debouncedSearch.trim() || undefined,
      sentiment: sentiment || undefined,
      event_type: event || undefined,
      stock: stock || undefined,
      source: source || undefined,
    }),
    [page, debouncedSearch, sentiment, event, stock, source],
  )

  const load = useCallback(() => {
    setLoading(true)
    newsApi
      .list(filters)
      .then((r) => setNews(r.data))
      .catch(() => toast.error('Không tải được dòng tin'))
      .finally(() => setLoading(false))
  }, [filters])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, sentiment, event, stock, source])

  // Đếm trên trang hiện tại để gợi ý người dùng còn lát cắt nào đáng xem.
  // Đây là số của trang, không phải của toàn bộ dữ liệu — nhãn nói rõ điều đó.
  const facetCounts = useMemo(() => {
    const sentiments: Record<string, number> = {}
    const events: Record<string, number> = {}
    const sources: Record<string, number> = {}
    const symbols: Record<string, number> = {}
    for (const n of news) {
      if (n.sentiment) sentiments[n.sentiment] = (sentiments[n.sentiment] || 0) + 1
      if (n.source) sources[n.source] = (sources[n.source] || 0) + 1
      for (const e of n.events_detected || []) events[e] = (events[e] || 0) + 1
      for (const s of n.stocks_mentioned || []) symbols[s] = (symbols[s] || 0) + 1
    }
    return { sentiments, events, sources, symbols }
  }, [news])

  const activeFilters = [
    sentiment && { key: 'sentiment', label: SENTIMENT_LABELS[sentiment] || sentiment },
    event && { key: 'event', label: EVENT_LABELS[event] || event },
    stock && { key: 'stock', label: `Mã ${stock}` },
    source && { key: 'source', label: source },
  ].filter(Boolean) as { key: string; label: string }[]

  const confirmDelete = async () => {
    if (!pendingDelete) return
    const id = pendingDelete.id
    setPendingDelete(null)
    try {
      await newsApi.delete(id)
      toast.success('Đã xoá bài báo')
      setNews((prev) => prev.filter((n) => n.id !== id))
    } catch {
      toast.error('Không xoá được. Thao tác này cần quyền quản trị viên.')
    }
  }

  const facetPanel = (
    <>
      <FacetGroup title="Tin tốt hay xấu">
        {['Positive', 'Neutral', 'Negative'].map((s) => (
          <FacetButton
            key={s}
            active={sentiment === s}
            onClick={() => setFacet('sentiment', s)}
            count={facetCounts.sentiments[s]}
            dotColor={SENTIMENT_COLORS[s]}
          >
            {SENTIMENT_LABELS[s]}
          </FacetButton>
        ))}
      </FacetGroup>

      <FacetGroup title="Chuyện gì xảy ra">
        {Object.entries(EVENT_LABELS).map(([key, label]) => (
          <FacetButton
            key={key}
            active={event === key}
            onClick={() => setFacet('event', key)}
            count={facetCounts.events[key]}
          >
            {label}
          </FacetButton>
        ))}
      </FacetGroup>

      {Object.keys(facetCounts.symbols).length > 0 && (
        <FacetGroup title="Mã được nhắc nhiều">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(facetCounts.symbols)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 12)
              .map(([sym, count]) => (
                <button key={sym} onClick={() => setFacet('stock', sym)} title={`Lọc theo ${sym}`}>
                  <span
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-semibold"
                    style={
                      stock === sym
                        ? { background: '#2563eb', color: 'white' }
                        : { background: 'rgba(37,99,235,0.10)', color: '#2563eb' }
                    }
                  >
                    {sym}
                    <span className="opacity-70 tabular-nums">{count}</span>
                  </span>
                </button>
              ))}
          </div>
        </FacetGroup>
      )}

      {Object.keys(facetCounts.sources).length > 1 && (
        <FacetGroup title="Báo nào đăng">
          {Object.entries(facetCounts.sources)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([src, count]) => (
              <FacetButton
                key={src}
                active={source === src}
                onClick={() => setFacet('source', src)}
                count={count}
              >
                {src}
              </FacetButton>
            ))}
        </FacetGroup>
      )}
    </>
  )

  return (
    <div className="p-4 sm:p-6 fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Dòng tin
          </h2>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Tin đã được đọc và phân tích — lọc theo tin tốt/xấu, loại sự việc, mã cổ phiếu hoặc báo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px]"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            <Filter size={13} /> Bộ lọc
            {activeFilters.length > 0 && (
              <span className="w-4 h-4 rounded-full text-[9px] flex items-center justify-center text-white" style={{ background: '#2563eb' }}>
                {activeFilters.length}
              </span>
            )}
          </button>
          <button
            onClick={load}
            aria-label="Tải lại dòng tin"
            className="p-2 rounded-xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <Link
            to="/import"
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-[13px] font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)' }}
          >
            <Upload size={13} />
            <span className="hidden sm:inline">Nhập dữ liệu</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[228px_1fr] gap-5">
        {/* Facet */}
        <aside
          className={`${showFilters ? 'block' : 'hidden'} lg:block rounded-2xl p-3.5 h-fit lg:sticky lg:top-4`}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          aria-label="Bộ lọc dòng tin"
        >
          {facetPanel}
          <button
            onClick={clearAll}
            disabled={activeFilters.length === 0 && !search}
            className="w-full px-2 py-1.5 rounded-lg text-[12px] disabled:opacity-40"
            style={{ color: 'var(--text-muted)' }}
          >
            Xoá toàn bộ bộ lọc
          </button>
        </aside>

        {/* Danh sách */}
        <div>
          <div className="relative mb-3">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
            <input
              className="field-input pl-8 h-10 text-[13px]"
              placeholder="Tìm theo tiêu đề trong toàn bộ dữ liệu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Tìm bài báo theo tiêu đề"
            />
          </div>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                Đang lọc:
              </span>
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFacet(f.key, '')}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(37,99,235,0.12)', color: '#2563eb' }}
                >
                  {f.label}
                  <X size={10} />
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton h-28 rounded-2xl" />
              ))}
            </div>
          ) : news.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 px-6 rounded-2xl text-center"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <Newspaper size={28} style={{ color: 'var(--text-faint)' }} />
              <p className="mt-3 text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>
                {activeFilters.length || search ? 'Không có tin nào khớp bộ lọc' : 'Chưa có tin nào'}
              </p>
              <p className="text-[12px] mt-1 max-w-sm" style={{ color: 'var(--text-muted)' }}>
                {activeFilters.length || search
                  ? 'Thử bỏ bớt điều kiện lọc, hoặc nhập thêm dữ liệu.'
                  : 'Thêm vài bài báo để hệ thống đọc và tìm ra mã cổ phiếu, sự việc liên quan.'}
              </p>
              <Link
                to="/import"
                className="mt-4 px-4 py-2 rounded-xl text-[13px] font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)' }}
              >
                Nhập dữ liệu
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {news.map((n) => (
                  <NewsCard
                    key={n.id}
                    news={n}
                    onDelete={isAdmin ? () => setPendingDelete(n) : undefined}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between mt-4">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="px-3 py-1.5 rounded-lg text-[12px] disabled:opacity-40"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                >
                  Trang trước
                </button>
                <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
                  Trang {page + 1}
                </span>
                <button
                  disabled={news.length < PAGE_SIZE}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg text-[12px] disabled:opacity-40"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                >
                  Trang sau
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.5)' }}
          role="dialog"
          aria-modal="true"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" style={{ color: '#ef4444' }} />
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Xoá bài báo này?
                </h3>
                <p className="text-[13px] mt-1 break-words" style={{ color: 'var(--text-secondary)' }}>
                  {pendingDelete.title}
                </p>
                <p className="text-[12px] mt-2" style={{ color: 'var(--text-faint)' }}>
                  Bài sẽ bị xoá vĩnh viễn khỏi hệ thống và khỏi sơ đồ liên kết. Không lấy lại được.
                </p>
              </div>
            </div>
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
                Xoá vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
