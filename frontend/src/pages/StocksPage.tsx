import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, TrendingUp } from 'lucide-react'
import { analyticsApi } from '../services/api'
import type { StockAggregation } from '../types'

export default function StocksPage() {
  const [stocks, setStocks] = useState<StockAggregation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    analyticsApi.stocks().then((r) => setStocks(r.data)).finally(() => setLoading(false))
  }, [])

  const filtered = stocks.filter((s) => {
    if (!search.trim()) return true
    const q = search.trim().toUpperCase()
    return s.symbol.includes(q) || (s.company || '').toUpperCase().includes(q)
  })

  return (
    <div className="p-6 space-y-4 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Cổ phiếu</h2>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Danh mục mã cổ phiếu được theo dõi cùng số lần nhắc đến trong tin tức
          </p>
        </div>
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
          <input
            className="field-input pl-9"
            placeholder="Tìm mã hoặc tên công ty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-2xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <TrendingUp size={32} style={{ color: 'var(--border-default)' }} className="mb-3" />
          <p className="text-[14px] font-medium" style={{ color: 'var(--text-muted)' }}>Không tìm thấy cổ phiếu</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((s) => {
            const total = Object.values(s.sentiment_distribution).reduce((a, b) => a + b, 0)
            const pos = s.sentiment_distribution.Positive || 0
            const posPct = total > 0 ? Math.round((pos / total) * 100) : 0
            return (
              <Link
                key={s.symbol}
                to={`/stocks/${s.symbol}`}
                className="rounded-2xl p-4 card-glow block"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{s.symbol}</span>
                  <span className="badge-blue text-[11px] px-2 py-0.5 rounded-full">{s.mention_count} tin</span>
                </div>
                <p className="text-[12px] truncate" style={{ color: 'var(--text-secondary)' }}>{s.company || '—'}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>{s.industry || '—'}</p>
                {total > 0 && (
                  <div className="conf-bar mt-3">
                    <div className="conf-bar-fill" style={{ width: `${posPct}%`, background: '#10b981' }} />
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
