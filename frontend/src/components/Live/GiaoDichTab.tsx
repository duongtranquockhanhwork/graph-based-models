import { useEffect, useRef, useState } from 'react'
import { ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Cell } from 'recharts'
import stockDetailApi from '../../services/stockDetailApi'
import type { Candle, IntradayTrade, LiveQuote } from '../../types'
import { fmtNumber } from '../../utils/stockColors'

const RANGES = [
  { label: '1T', days: 30 },
  { label: '3T', days: 90 },
  { label: '6T', days: 180 },
  { label: '1N', days: 365 },
  { label: 'Tất cả', days: 1500 },
] as const

const TRADE_POLL_MS = 5000

interface CandleShapeProps {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: Candle
}

function CandleShape(props: CandleShapeProps) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props
  if (!payload) return null
  const { open, close, high, low } = payload
  const isUp = close >= open
  const color = isUp ? '#10b981' : '#ef4444'
  const range = high - low || 1
  const scale = height / range
  const bodyTop = y + (high - Math.max(open, close)) * scale
  const bodyBottom = y + (high - Math.min(open, close)) * scale
  const bodyHeight = Math.max(1, bodyBottom - bodyTop)
  const centerX = x + width / 2
  return (
    <g>
      <line x1={centerX} x2={centerX} y1={y} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={x} y={bodyTop} width={Math.max(1, width)} height={bodyHeight} fill={color} />
    </g>
  )
}

function DepthRow({ label, bidPrice, bidVolume, askPrice, askVolume }: { label: string; bidPrice: number; bidVolume: number; askPrice: number; askVolume: number }) {
  return (
    <tr style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <td className="py-1.5 text-[11px]" style={{ color: 'var(--text-faint)' }}>{label}</td>
      <td className="py-1.5 text-right text-[12px]" style={{ color: 'var(--text-faint)' }}>{bidVolume ? fmtNumber(bidVolume) : '—'}</td>
      <td className="py-1.5 text-right text-[12px] font-medium" style={{ color: '#10b981' }}>{bidPrice ? fmtNumber(bidPrice) : '—'}</td>
      <td className="py-1.5 pl-3 text-[12px] font-medium" style={{ color: '#ef4444' }}>{askPrice ? fmtNumber(askPrice) : '—'}</td>
      <td className="py-1.5 text-[12px]" style={{ color: 'var(--text-faint)' }}>{askVolume ? fmtNumber(askVolume) : '—'}</td>
    </tr>
  )
}

export default function GiaoDichTab({ symbol, quote }: { symbol: string; quote: LiveQuote }) {
  const [days, setDays] = useState<number>(180)
  const [candles, setCandles] = useState<Candle[] | undefined>()
  const [candlesLoading, setCandlesLoading] = useState(false)
  const [trades, setTrades] = useState<IntradayTrade[] | undefined>()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setCandlesLoading(true)
    stockDetailApi
      .history(symbol, days)
      .then((r) => setCandles(r.data))
      .catch(() => setCandles([]))
      .finally(() => setCandlesLoading(false))
  }, [symbol, days])

  useEffect(() => {
    const loadTrades = () => {
      stockDetailApi.intraday(symbol, 40).then((r) => setTrades(r.data)).catch(() => {})
    }
    loadTrades()
    pollRef.current = setInterval(loadTrades, TRADE_POLL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [symbol])

  const bidTotal = quote.bid_1_volume + quote.bid_2_volume + quote.bid_3_volume
  const askTotal = quote.ask_1_volume + quote.ask_2_volume + quote.ask_3_volume
  const bidPct = bidTotal + askTotal > 0 ? (bidTotal / (bidTotal + askTotal)) * 100 : 50

  const depthData = [
    { level: 'Mua 3', volume: quote.bid_3_volume, side: 'bid' },
    { level: 'Mua 2', volume: quote.bid_2_volume, side: 'bid' },
    { level: 'Mua 1', volume: quote.bid_1_volume, side: 'bid' },
    { level: 'Bán 1', volume: quote.ask_1_volume, side: 'ask' },
    { level: 'Bán 2', volume: quote.ask_2_volume, side: 'ask' },
    { level: 'Bán 3', volume: quote.ask_3_volume, side: 'ask' },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Chart + volume */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center gap-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setDays(r.days)}
              className="px-2.5 py-1 rounded-lg text-[11px] transition-all"
              style={
                days === r.days
                  ? { background: 'rgba(37,99,235,0.2)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.3)' }
                  : { color: 'var(--text-muted)', border: '1px solid transparent' }
              }
            >
              {r.label}
            </button>
          ))}
        </div>

        {candlesLoading ? (
          <div className="skeleton h-64 rounded-2xl" />
        ) : !candles || candles.length === 0 ? (
          <p className="text-[12px] py-16 text-center" style={{ color: 'var(--text-faint)' }}>Chưa có dữ liệu lịch sử giá</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={candles} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} minTickGap={30} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 10 }} width={70} tickFormatter={(v) => fmtNumber(v)} />
                <Tooltip
                  formatter={(_: number, __: string, item) => {
                    const c = item.payload as Candle
                    return [`O:${fmtNumber(c.open)} H:${fmtNumber(c.high)} L:${fmtNumber(c.low)} C:${fmtNumber(c.close)}`, '']
                  }}
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 10, fontSize: 11 }}
                />
                <Bar dataKey="high" shape={CandleShape as unknown as never} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={candles} margin={{ top: 0, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="time" hide />
                <YAxis hide />
                <Tooltip
                  formatter={(v: number) => [fmtNumber(v), 'KL']}
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 10, fontSize: 11 }}
                />
                <Bar dataKey="volume" isAnimationActive={false}>
                  {candles.map((c, i) => (
                    <Cell key={i} fill={c.close >= c.open ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* Depth + tape */}
      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-faint)' }}>Độ sâu thị trường</p>
          <table className="w-full">
            <thead>
              <tr style={{ color: 'var(--text-faint)' }}>
                <th className="text-left text-[10px] font-medium pb-1">Giá</th>
                <th className="text-right text-[10px] font-medium pb-1">KL</th>
                <th className="text-right text-[10px] font-medium pb-1">Mua</th>
                <th className="text-left text-[10px] font-medium pb-1 pl-3">Bán</th>
                <th className="text-left text-[10px] font-medium pb-1">KL</th>
              </tr>
            </thead>
            <tbody>
              <DepthRow label="1" bidPrice={quote.bid_1_price} bidVolume={quote.bid_1_volume} askPrice={quote.ask_1_price} askVolume={quote.ask_1_volume} />
              <DepthRow label="2" bidPrice={quote.bid_2_price} bidVolume={quote.bid_2_volume} askPrice={quote.ask_2_price} askVolume={quote.ask_2_volume} />
              <DepthRow label="3" bidPrice={quote.bid_3_price} bidVolume={quote.bid_3_volume} askPrice={quote.ask_3_price} askVolume={quote.ask_3_volume} />
            </tbody>
          </table>
          <div className="flex items-center justify-between text-[11px] mt-2" style={{ color: 'var(--text-faint)' }}>
            <span>Dư mua: {fmtNumber(bidTotal)}</span>
            <span>Dư bán: {fmtNumber(askTotal)}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden mt-1" style={{ background: 'rgba(239,68,68,0.2)' }}>
            <div className="h-full" style={{ width: `${bidPct}%`, background: '#10b981' }} />
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-faint)' }}>Biểu đồ độ sâu</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={depthData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="level" tick={{ fill: '#64748b', fontSize: 10 }} width={40} />
              <Tooltip formatter={(v: number) => [fmtNumber(v), 'KL']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 10, fontSize: 11 }} />
              <Bar dataKey="volume" isAnimationActive={false}>
                {depthData.map((d, i) => <Cell key={i} fill={d.side === 'bid' ? '#10b981' : '#ef4444'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-faint)' }}>Khớp lệnh</p>
          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr style={{ color: 'var(--text-faint)' }}>
                  <th className="text-left font-medium pb-1">Thời gian</th>
                  <th className="text-right font-medium pb-1">Giá</th>
                  <th className="text-right font-medium pb-1">KL</th>
                  <th className="text-right font-medium pb-1">M/B</th>
                </tr>
              </thead>
              <tbody>
                {(trades || []).map((t) => (
                  <tr key={t.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="py-1" style={{ color: 'var(--text-faint)' }}>{t.time.slice(11, 19)}</td>
                    <td className="py-1 text-right font-medium" style={{ color: t.match_type === 'buy' ? '#10b981' : '#ef4444' }}>{fmtNumber(t.price)}</td>
                    <td className="py-1 text-right" style={{ color: 'var(--text-secondary)' }}>{fmtNumber(t.volume)}</td>
                    <td className="py-1 text-right font-medium" style={{ color: t.match_type === 'buy' ? '#10b981' : '#ef4444' }}>
                      {t.match_type === 'buy' ? 'M' : 'B'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
