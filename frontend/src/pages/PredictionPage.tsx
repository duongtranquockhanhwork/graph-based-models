import { useEffect, useState } from 'react'
import { predictionApi } from '../services/api'
import type { Prediction } from '../types'
import { TrendingUp, TrendingDown, Minus, Search, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'

const TREND_CONFIG = {
  INCREASING: {
    icon: TrendingUp,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.2)',
    label: 'Tăng',
    badgeClass: 'badge-up',
  },
  DECREASING: {
    icon: TrendingDown,
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.2)',
    label: 'Giảm',
    badgeClass: 'badge-down',
  },
  UNCHANGED: {
    icon: Minus,
    color: '#64748b',
    bg: 'rgba(100,116,139,0.08)',
    border: 'rgba(100,116,139,0.15)',
    label: 'Ổn định',
    badgeClass: 'badge-neutral',
  },
}

function PredCard({ pred }: { pred: Prediction }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = TREND_CONFIG[pred.trend as keyof typeof TREND_CONFIG] || TREND_CONFIG.UNCHANGED
  const Icon = cfg.icon
  const confidence = Math.round((pred.confidence || 0) * 100)

  return (
    <div
      className="rounded-2xl p-4 card-glow cursor-pointer"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl font-bold text-white">{pred.stock_symbol}</span>
          <div
            className={`flex items-center gap-1 ${cfg.badgeClass} text-[11px] px-2 py-0.5 rounded-full font-medium`}
          >
            <Icon size={10} />
            {cfg.label}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-lg font-bold text-white">{confidence}%</div>
          <div className="text-[10px]" style={{ color: '#3d5a7a' }}>độ tin cậy</div>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="conf-bar mb-3">
        <div
          className="conf-bar-fill"
          style={{
            width: `${confidence}%`,
            background: cfg.color,
            opacity: 0.8,
          }}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {pred.sentiment && (
          <span className={`${
            pred.sentiment === 'Positive' ? 'badge-up' :
            pred.sentiment === 'Negative' ? 'badge-down' : 'badge-neutral'
          } text-[10px] px-2 py-0.5 rounded-full`}>
            {pred.sentiment}
          </span>
        )}
        {(pred.events || []).slice(0, 2).map(ev => (
          <span key={ev} className="badge-blue text-[10px] px-2 py-0.5 rounded-full">
            {ev.replace(/_/g, ' ')}
          </span>
        ))}
      </div>

      {expanded && pred.explanation && (
        <div
          className="mt-3 pt-3 space-y-1.5"
          style={{ borderTop: `1px solid ${cfg.border}` }}
        >
          <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: '#3d5a7a' }}>
            Lý do dự đoán
          </p>
          {pred.explanation.reasons?.map((r, i) => (
            <p key={i} className="text-[12px]" style={{ color: '#94a3b8' }}>
              · {r}
            </p>
          ))}
          {pred.explanation.composite_score !== undefined && (
            <p className="text-[11px] mt-2" style={{ color: '#3d5a7a' }}>
              Điểm tổng hợp: <span className="text-white font-medium">{pred.explanation.composite_score}</span>
            </p>
          )}
          {pred.news_title && (
            <p className="text-[11px] truncate" style={{ color: '#3d5a7a' }}>
              Nguồn tin: {pred.news_title}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end mt-2">
        <span style={{ color: '#3d5a7a' }}>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </div>
    </div>
  )
}

export default function PredictionPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchResult, setSearchResult] = useState<Prediction | null>(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    predictionApi.list().then(r => setPredictions(r.data)).finally(() => setLoading(false))
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!search.trim()) return
    setSearching(true)
    try {
      const res = await predictionApi.forStock(search.trim().toUpperCase())
      setSearchResult(res.data)
    } catch {
      toast.error(`Không tìm thấy dữ liệu cho ${search.toUpperCase()}`)
      setSearchResult(null)
    } finally {
      setSearching(false)
    }
  }

  const grouped = {
    INCREASING: predictions.filter(p => p.trend === 'INCREASING'),
    DECREASING: predictions.filter(p => p.trend === 'DECREASING'),
    UNCHANGED: predictions.filter(p => p.trend === 'UNCHANGED'),
  }

  const inc = grouped.INCREASING.length
  const dec = grouped.DECREASING.length
  const unch = grouped.UNCHANGED.length
  const total = inc + dec + unch

  return (
    <div className="p-6 space-y-5 fade-in">
      {/* Summary stats */}
      {!loading && total > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Tăng', count: inc, color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', Icon: TrendingUp },
            { label: 'Giảm', count: dec, color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', Icon: TrendingDown },
            { label: 'Ổn định', count: unch, color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.15)', Icon: Minus },
          ].map(({ label, count, color, bg, border, Icon: Ico }) => (
            <div
              key={label}
              className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: bg, border: `1px solid ${border}` }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: color + '22' }}
              >
                <Ico size={18} style={{ color }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white leading-none">{count}</p>
                <p className="text-[11px] mt-0.5" style={{ color }}>Cổ phiếu {label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div
        className="rounded-2xl p-5 card-glow"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <h3 className="text-white font-semibold text-[14px] mb-3">Tra cứu theo mã cổ phiếu</h3>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#3d5a7a' }} />
            <input
              className="field-input pl-9 uppercase tracking-widest h-10"
              placeholder="FPT · VNM · HPG · VCB..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-medium transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)', color: 'white' }}
          >
            {searching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            {searching ? 'Đang tìm...' : 'Dự đoán'}
          </button>
        </form>
        {searchResult && (
          <div className="mt-4">
            <PredCard pred={searchResult} />
          </div>
        )}
      </div>

      {/* Predictions grouped */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      ) : predictions.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-2xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <TrendingUp size={36} style={{ color: '#1e3556' }} className="mb-3" />
          <p className="text-[14px] font-medium" style={{ color: '#475569' }}>Chưa có dự đoán</p>
          <p className="text-[12px] mt-1" style={{ color: '#334155' }}>Hãy phân tích tin tức trước</p>
        </div>
      ) : (
        <div className="space-y-5">
          {(Object.entries(grouped) as [string, Prediction[]][]).map(([trend, preds]) => {
            if (preds.length === 0) return null
            const cfg = TREND_CONFIG[trend as keyof typeof TREND_CONFIG]
            return (
              <div key={trend}>
                <div className="flex items-center gap-2 mb-3">
                  <cfg.icon size={15} style={{ color: cfg.color }} />
                  <h3 className="font-semibold text-[13px]" style={{ color: cfg.color }}>
                    {cfg.label} · {preds.length} cổ phiếu
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {preds.map((p, i) => <PredCard key={`${p.stock_symbol}-${i}`} pred={p} />)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
