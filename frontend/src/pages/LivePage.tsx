import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, X, Radio, TrendingUp } from 'lucide-react'
import watchlistApi from '../services/watchlistApi'
import type { LiveQuote } from '../types'
import { trendColor, fmtNumber, COLOR_CEILING, COLOR_FLOOR, COLOR_REFERENCE } from '../utils/stockColors'
import StockDetailModal from '../components/Live/StockDetailModal'

const POLL_INTERVAL_MS = 10000

export default function LivePage() {
  const [quotes, setQuotes] = useState<LiveQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [symbolInput, setSymbolInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [openSymbol, setOpenSymbol] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadLive = async () => {
    try {
      const res = await watchlistApi.live()
      setQuotes(res.data)
    } catch {
      // giữ nguyên dữ liệu cũ nếu 1 lần poll lỗi tạm thời (vd. rate limit nguồn dữ liệu)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLive()
    pollRef.current = setInterval(loadLive, POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const symbol = symbolInput.trim().toUpperCase()
    if (!symbol) return
    setAdding(true)
    try {
      await watchlistApi.add(symbol)
      toast.success(`Đã thêm ${symbol} vào bảng live`)
      setSymbolInput('')
      await loadLive()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Không thể thêm mã cổ phiếu'
      toast.error(msg)
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (symbol: string) => {
    setRemoving(symbol)
    try {
      await watchlistApi.remove(symbol)
      setQuotes((prev) => prev.filter((q) => q.symbol !== symbol))
      toast.success(`Đã bỏ ${symbol} khỏi bảng live`)
    } catch {
      toast.error('Không thể xoá mã cổ phiếu')
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="p-6 space-y-4 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Radio size={18} style={{ color: '#ef4444' }} />
            Bảng giá Live
          </h2>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Giá thực tế cập nhật mỗi {POLL_INTERVAL_MS / 1000} giây từ dữ liệu thị trường chứng khoán Việt Nam
          </p>
        </div>

        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <input
            className="field-input w-40"
            placeholder="Nhập mã, vd: FPT"
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
            maxLength={10}
          />
          <button
            type="submit"
            disabled={adding || !symbolInput.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)' }}
          >
            <Plus size={14} /> {adding ? 'Đang thêm...' : 'Thêm'}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-14 rounded-2xl" />
          ))}
        </div>
      ) : quotes.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-2xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <TrendingUp size={32} style={{ color: 'var(--border-default)' }} className="mb-3" />
          <p className="text-[14px] font-medium" style={{ color: 'var(--text-muted)' }}>
            Chưa theo dõi mã cổ phiếu nào
          </p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-faint)' }}>
            Nhập mã cổ phiếu ở ô phía trên để bắt đầu theo dõi giá live
          </p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ color: 'var(--text-faint)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Mã', 'Công ty', 'Giá khớp', '+/-', '%', 'Khối lượng', 'Trần / TC / Sàn', ''].map((h) => (
                    <th key={h} className="text-left font-medium px-3 py-2.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr
                    key={q.symbol}
                    onClick={() => setOpenSymbol(q.symbol)}
                    className="cursor-pointer transition-colors"
                    style={{ borderTop: '1px solid var(--border-subtle)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(37,99,235,0.05)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                  >
                    <td className="px-3 py-2.5 font-semibold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{q.symbol}</td>
                    <td className="px-3 py-2.5 max-w-[220px] truncate" style={{ color: 'var(--text-secondary)' }}>{q.company_name || '—'}</td>
                    <td className="px-3 py-2.5 font-semibold whitespace-nowrap" style={{ color: trendColor(q.change) }}>{fmtNumber(q.price)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: trendColor(q.change) }}>
                      {q.change > 0 ? '+' : ''}{fmtNumber(q.change)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: trendColor(q.change) }}>
                      {q.percent_change > 0 ? '+' : ''}{q.percent_change.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{fmtNumber(q.volume)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-[11px]">
                      <span style={{ color: COLOR_CEILING }}>{fmtNumber(q.ceiling)}</span>
                      {' / '}
                      <span style={{ color: COLOR_REFERENCE }}>{fmtNumber(q.reference_price)}</span>
                      {' / '}
                      <span style={{ color: COLOR_FLOOR }}>{fmtNumber(q.floor)}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemove(q.symbol) }}
                        disabled={removing === q.symbol}
                        className="p-1.5 rounded-lg transition-all disabled:opacity-50"
                        style={{ color: 'var(--text-faint)' }}
                        title="Bỏ theo dõi"
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
      )}

      {openSymbol && (
        <StockDetailModal
          symbol={openSymbol}
          quote={quotes.find((q) => q.symbol === openSymbol) || null}
          onClose={() => setOpenSymbol(null)}
        />
      )}
    </div>
  )
}
