import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Pause, Plus, RefreshCw, Search, Star, TrendingUp, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { analyticsApi } from '../services/api'
import watchlistApi from '../services/watchlistApi'
import type { LiveQuote, StockAggregation } from '../types'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { COLOR_CEILING, COLOR_FLOOR, COLOR_REFERENCE, fmtNumber, trendColor } from '../utils/stockColors'
import { SENTIMENT_COLORS, SENTIMENT_LABELS } from '../components/common/Chips'

const REFRESH_OPTIONS = [
  { label: '5 giây', ms: 5000 },
  { label: '10 giây', ms: 10000 },
  { label: '30 giây', ms: 30000 },
  { label: '1 phút', ms: 60000 },
  { label: 'Tắt', ms: 0 },
] as const

const STORAGE_KEY = 'finnexus_live_interval'

type Tab = 'watchlist' | 'all'

function SentimentBar({ distribution }: { distribution: Record<string, number> }) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0)
  if (total === 0) {
    return (
      <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
        —
      </span>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-1.5 w-20 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
        {(['Positive', 'Neutral', 'Negative'] as const).map((k) =>
          distribution[k] ? (
            <div
              key={k}
              style={{ width: `${(distribution[k] / total) * 100}%`, background: SENTIMENT_COLORS[k] }}
              title={`${SENTIMENT_LABELS[k]}: ${distribution[k]}`}
            />
          ) : null,
        )}
      </div>
      <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
        {total}
      </span>
    </div>
  )
}

/** Cổ phiếu — danh mục theo dõi và toàn bộ mã, trong một trang.
 *
 * Trước đây tách làm hai: "Cổ phiếu" (danh sách tĩnh, không giá) và "Bảng giá
 * Live" (giá nhưng không có ngữ cảnh tin tức). Người dùng phải nhớ mã rồi tự
 * đi qua lại giữa hai trang. Ở đây cả hai là hai tab của cùng một câu hỏi —
 * "mã nào đáng chú ý" — và mọi dòng đều dẫn tới hồ sơ mã.
 */
export default function StocksPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  // Trang này được gắn ở cả khu vực khách hàng (/stocks/:symbol) lẫn khu vực
  // quản trị (/admin/stocks/:symbol) — điều hướng bằng đường dẫn tuyệt đối cũ
  // luôn thoát ra ngoài /admin, khiến admin rơi vào route dành cho khách hàng
  // và bị ProtectedRoute bật ngược về /admin/dashboard.
  const stockPath = (symbol: string) => (user?.role === 'admin' ? `/admin/stocks/${symbol}` : `/stocks/${symbol}`)
  const [tab, setTab] = useState<Tab>('watchlist')
  const [quotes, setQuotes] = useState<LiveQuote[]>([])
  const [all, setAll] = useState<StockAggregation[]>([])
  const [allLoading, setAllLoading] = useState(false)
  const [symbolInput, setSymbolInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')

  const [intervalMs, setIntervalMs] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved !== null && REFRESH_OPTIONS.some((o) => o.ms === Number(saved))) return Number(saved)
    } catch {
      /* bỏ qua */
    }
    return 10000
  })

  const changeInterval = (ms: number) => {
    setIntervalMs(ms)
    try {
      localStorage.setItem(STORAGE_KEY, String(ms))
    } catch {
      /* bỏ qua */
    }
  }

  const loadLive = useCallback(async () => {
    try {
      const res = await watchlistApi.live()
      setQuotes(res.data)
    } catch {
      // Giữ giá cũ kèm mốc thời gian thay vì xoá trắng bảng.
    }
  }, [])

  const { lastUpdated, secondsLeft, paused, marketOpen, refreshing, refreshNow } = useAutoRefresh(
    loadLive,
    { intervalMs, enabled: tab === 'watchlist' },
  )

  const loadAll = useCallback(() => {
    if (all.length > 0) return
    setAllLoading(true)
    analyticsApi
      .stocks()
      .then((r) => setAll(r.data))
      .catch(() => toast.error('Không tải được danh sách mã'))
      .finally(() => setAllLoading(false))
  }, [all.length])

  const switchTab = (next: Tab) => {
    setTab(next)
    if (next === 'all') loadAll()
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const symbol = symbolInput.trim().toUpperCase()
    if (!symbol) return
    setAdding(true)
    try {
      await watchlistApi.add(symbol)
      toast.success(`Đã thêm ${symbol} vào danh mục theo dõi`)
      setSymbolInput('')
      refreshNow()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Không thể thêm mã cổ phiếu'
      toast.error(msg)
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (symbol: string) => {
    try {
      await watchlistApi.remove(symbol)
      setQuotes((prev) => prev.filter((q) => q.symbol !== symbol))
      toast.success(`Đã bỏ theo dõi ${symbol}`)
    } catch {
      toast.error('Không thể bỏ theo dõi')
    }
  }

  const watched = useMemo(() => new Set(quotes.map((q) => q.symbol)), [quotes])

  const filteredAll = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = q
      ? all.filter(
          (s) => s.symbol.toLowerCase().includes(q) || (s.company || '').toLowerCase().includes(q),
        )
      : all
    return rows
  }, [all, search])

  return (
    <div className="p-4 sm:p-6 fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Cổ phiếu
          </h2>
          {tab === 'watchlist' ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: marketOpen ? '#10b981' : '#94a3b8' }} />
                {marketOpen ? 'Đang trong phiên' : 'Ngoài giờ giao dịch'}
              </span>
              {lastUpdated && <span>Cập nhật {lastUpdated.toLocaleTimeString('vi-VN')}</span>}
              {paused ? (
                <span className="inline-flex items-center gap-1" style={{ color: '#b45309' }}>
                  <Pause size={11} /> Tạm dừng khi rời tab
                </span>
              ) : secondsLeft !== null ? (
                <span>Làm mới sau {secondsLeft}s</span>
              ) : (
                <span>Tự động cập nhật đang tắt</span>
              )}
            </div>
          ) : (
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Toàn bộ mã trong từ điển, kèm số tin đã phân tích và phân bố cảm xúc
            </p>
          )}
        </div>

        {tab === 'watchlist' && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="field-input w-28"
              value={intervalMs}
              onChange={(e) => changeInterval(Number(e.target.value))}
              aria-label="Tần suất tự động cập nhật giá"
            >
              {REFRESH_OPTIONS.map((o) => (
                <option key={o.ms} value={o.ms}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              onClick={refreshNow}
              disabled={refreshing}
              aria-label="Cập nhật giá ngay"
              className="p-2 rounded-xl disabled:opacity-60"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <form onSubmit={handleAdd} className="flex items-center gap-2">
              <input
                className="field-input w-28 sm:w-36"
                placeholder="Thêm mã, vd: FPT"
                value={symbolInput}
                onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                maxLength={10}
                aria-label="Mã cổ phiếu cần thêm"
              />
              <button
                type="submit"
                disabled={adding || !symbolInput.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)' }}
              >
                <Plus size={14} /> Thêm
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Tab */}
      <div className="flex gap-1 mb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        {([
          { key: 'watchlist', label: 'Đang theo dõi', count: quotes.length },
          { key: 'all', label: 'Tất cả mã', count: all.length || undefined },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className="px-3.5 py-2.5 text-[13px] transition-colors relative"
            style={{
              color: tab === t.key ? '#2563eb' : 'var(--text-muted)',
              fontWeight: tab === t.key ? 600 : 400,
              borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {t.label}
            {t.count != null && (
              <span className="ml-1.5 text-[11px] tabular-nums opacity-70">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'watchlist' ? (
        quotes.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 px-6 rounded-2xl text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <Star size={28} style={{ color: 'var(--text-faint)' }} />
            <p className="mt-3 text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>
              Chưa theo dõi mã nào
            </p>
            <p className="text-[12px] mt-1 max-w-sm" style={{ color: 'var(--text-muted)' }}>
              Nhập mã ở ô phía trên, hoặc mở tab <strong>Tất cả mã</strong> để chọn. Mã được nhắc
              trong bài báo bạn nhập cũng tự xuất hiện ở đây.
            </p>
            <button
              onClick={() => switchTab('all')}
              className="mt-4 px-4 py-2 rounded-xl text-[13px] font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)' }}
            >
              Xem tất cả mã
            </button>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]" style={{ minWidth: 720 }}>
                <thead>
                  <tr style={{ color: 'var(--text-faint)', borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Mã', 'Công ty', 'Giá khớp', '+/-', '%', 'Khối lượng', 'Trần / TC / Sàn', ''].map((h) => (
                      <th key={h} className="text-left font-medium px-3 py-2.5 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr
                      key={q.symbol}
                      onClick={() => navigate(stockPath(q.symbol))}
                      className="cursor-pointer transition-colors"
                      style={{ borderTop: '1px solid var(--border-subtle)' }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLTableRowElement).style.background = 'rgba(37,99,235,0.05)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                      }}
                    >
                      <td className="px-3 py-2.5 font-semibold whitespace-nowrap" style={{ color: '#2563eb' }}>
                        {q.symbol}
                      </td>
                      <td className="px-3 py-2.5 max-w-[220px] truncate" style={{ color: 'var(--text-secondary)' }}>
                        {q.company_name || '—'}
                      </td>
                      <td className="px-3 py-2.5 font-semibold whitespace-nowrap tabular-nums" style={{ color: trendColor(q.change) }}>
                        {fmtNumber(q.price)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap tabular-nums" style={{ color: trendColor(q.change) }}>
                        {q.change > 0 ? '+' : ''}
                        {fmtNumber(q.change)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap tabular-nums" style={{ color: trendColor(q.change) }}>
                        {q.percent_change > 0 ? '+' : ''}
                        {q.percent_change.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {fmtNumber(q.volume)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-[11px] tabular-nums">
                        <span style={{ color: COLOR_CEILING }}>{fmtNumber(q.ceiling)}</span>
                        {' / '}
                        <span style={{ color: COLOR_REFERENCE }}>{fmtNumber(q.reference_price)}</span>
                        {' / '}
                        <span style={{ color: COLOR_FLOOR }}>{fmtNumber(q.floor)}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemove(q.symbol)
                          }}
                          aria-label={`Bỏ theo dõi ${q.symbol}`}
                          className="p-1.5 rounded-lg"
                          style={{ color: 'var(--text-faint)' }}
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <>
          <div className="relative mb-3 max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
            <input
              className="field-input pl-8 h-9 text-[13px]"
              placeholder="Tìm theo mã hoặc tên công ty…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Tìm mã cổ phiếu"
            />
          </div>

          {allLoading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton h-14 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]" style={{ minWidth: 640 }}>
                  <thead>
                    <tr style={{ color: 'var(--text-faint)', borderBottom: '1px solid var(--border-subtle)' }}>
                      {['Mã', 'Công ty', 'Ngành', 'Số tin', 'Phân bố cảm xúc', ''].map((h) => (
                        <th key={h} className="text-left font-medium px-3 py-2.5 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAll.map((s) => (
                      <tr
                        key={s.symbol}
                        onClick={() => navigate(stockPath(s.symbol))}
                        className="cursor-pointer transition-colors"
                        style={{ borderTop: '1px solid var(--border-subtle)' }}
                        onMouseEnter={(e) => {
                          ;(e.currentTarget as HTMLTableRowElement).style.background = 'rgba(37,99,235,0.05)'
                        }}
                        onMouseLeave={(e) => {
                          ;(e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                        }}
                      >
                        <td className="px-3 py-2.5 font-semibold whitespace-nowrap" style={{ color: '#2563eb' }}>
                          {s.symbol}
                        </td>
                        <td className="px-3 py-2.5 max-w-[240px] truncate" style={{ color: 'var(--text-secondary)' }}>
                          {s.company || '—'}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-[12px]" style={{ color: 'var(--text-muted)' }}>
                          {s.industry || '—'}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {s.mention_count}
                        </td>
                        <td className="px-3 py-2.5">
                          <SentimentBar distribution={s.sentiment_distribution} />
                        </td>
                        <td className="px-3 py-2.5">
                          {watched.has(s.symbol) ? (
                            <span className="text-[11px] inline-flex items-center gap-1" style={{ color: '#0b7d5a' }}>
                              <Star size={11} fill="currentColor" /> Đang theo dõi
                            </span>
                          ) : (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                try {
                                  await watchlistApi.add(s.symbol)
                                  toast.success(`Đã theo dõi ${s.symbol}`)
                                  refreshNow()
                                } catch {
                                  toast.error(`Không thêm được ${s.symbol}`)
                                }
                              }}
                              className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-lg"
                              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
                            >
                              <Star size={11} /> Theo dõi
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!allLoading && filteredAll.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-14 rounded-2xl text-center"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <TrendingUp size={26} style={{ color: 'var(--text-faint)' }} />
              <p className="mt-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                Không có mã nào khớp “{search}”
              </p>
            </div>
          )}
        </>
      )}

      <p className="text-[11px] mt-4" style={{ color: 'var(--text-faint)' }}>
        Giá do vnstock cung cấp. Đây là công cụ nghiên cứu, không phải khuyến nghị đầu tư —{' '}
        <Link to="/reports" className="hover:underline" style={{ color: '#2563eb' }}>
          xem bằng chứng mô hình
        </Link>
        .
      </p>
    </div>
  )
}
