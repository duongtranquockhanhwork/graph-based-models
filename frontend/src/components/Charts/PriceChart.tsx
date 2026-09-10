import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AreaChart,
  BarChart3,
  CandlestickChart,
  LineChart as LineIcon,
  Maximize2,
  Minus as MinusIcon,
  Plus as PlusIcon,
} from 'lucide-react'
import type { Candle } from '../../types'
import { fmtNumber } from '../../utils/stockColors'

export type ChartType = 'candle' | 'ohlc' | 'line' | 'area' | 'bar'

export const CHART_TYPES: { key: ChartType; label: string; icon: typeof CandlestickChart }[] = [
  { key: 'candle', label: 'Nến', icon: CandlestickChart },
  { key: 'ohlc', label: 'Thanh OHLC', icon: BarChart3 },
  { key: 'line', label: 'Đường', icon: LineIcon },
  { key: 'area', label: 'Vùng', icon: AreaChart },
  { key: 'bar', label: 'Cột', icon: BarChart3 },
]

const UP = '#10b981'
const DOWN = '#ef4444'
const MA_COLORS: Record<number, string> = { 20: '#f59e0b', 50: '#8b5cf6' }

// Hình học vùng vẽ. Khai báo tường minh thay vì để recharts tự chọn, vì phần
// crosshair phải quy đổi toạ độ chuột sang giá — muốn chính xác thì phải biết
// chắc mép trên/dưới của vùng vẽ nằm ở đâu.
const PLOT = { top: 8, right: 8, bottom: 0, left: 0 }
const Y_AXIS_WIDTH = 62
const X_AXIS_HEIGHT = 24

/** Số nến ít nhất còn giữ lại khi phóng to hết cỡ. Dưới mức này thì mỗi nến
 *  rộng cả trăm pixel và biểu đồ mất ý nghĩa. */
const MIN_VISIBLE = 12

interface ChartCandle extends Candle {
  /** Cặp [low, high]. Recharts vẽ Bar có dataKey trả mảng hai phần tử từ giá
   *  trị thứ nhất tới giá trị thứ hai, nên `y`/`height` mà shape nhận được ứng
   *  đúng khoảng low–high. */
  range: [number, number]
  ma20: number | null
  ma50: number | null
}

function movingAverage(candles: Candle[], period: number): (number | null)[] {
  const out: (number | null)[] = []
  let sum = 0
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close
    if (i >= period) sum -= candles[i - period].close
    out.push(i >= period - 1 ? sum / period : null)
  }
  return out
}

interface ShapeProps {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: ChartCandle
}

/** Nến Nhật: thân từ open đến close, bấc từ low đến high. */
function CandleShape({ x = 0, y = 0, width = 0, height = 0, payload }: ShapeProps) {
  if (!payload) return null
  const { open, close, high, low } = payload
  const span = high - low
  const color = close >= open ? UP : DOWN
  const centerX = x + width / 2

  // span = 0 khi giá không đổi suốt phiên (mã ít thanh khoản). Vẽ vạch ngang
  // thay vì chia cho 0.
  if (span === 0) {
    return <line x1={x} x2={x + width} y1={y} y2={y} stroke={color} strokeWidth={1.5} />
  }

  const scale = height / span
  const bodyTop = y + (high - Math.max(open, close)) * scale
  const bodyHeight = Math.max(1, Math.abs(close - open) * scale)
  const bodyWidth = Math.max(1, width * 0.7)

  return (
    <g>
      <line x1={centerX} x2={centerX} y1={y} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={centerX - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} />
    </g>
  )
}

/** Thanh OHLC: sổ dọc low–high, gạch trái = mở cửa, gạch phải = đóng cửa. */
function OhlcShape({ x = 0, y = 0, width = 0, height = 0, payload }: ShapeProps) {
  if (!payload) return null
  const { open, close, high, low } = payload
  const span = high - low
  const color = close >= open ? UP : DOWN
  const centerX = x + width / 2
  if (span === 0) {
    return <line x1={x} x2={x + width} y1={y} y2={y} stroke={color} strokeWidth={1.5} />
  }
  const scale = height / span
  const openY = y + (high - open) * scale
  const closeY = y + (high - close) * scale
  const tick = Math.max(2, width * 0.4)

  return (
    <g>
      <line x1={centerX} x2={centerX} y1={y} y2={y + height} stroke={color} strokeWidth={1.2} />
      <line x1={centerX - tick} x2={centerX} y1={openY} y2={openY} stroke={color} strokeWidth={1.2} />
      <line x1={centerX} x2={centerX + tick} y1={closeY} y2={closeY} stroke={color} strokeWidth={1.2} />
    </g>
  )
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartCandle }[] }) {
  if (!active || !payload?.length) return null
  const c = payload[0].payload
  const up = c.close >= c.open
  const rows: [string, string][] = [
    ['Mở', fmtNumber(c.open)],
    ['Cao', fmtNumber(c.high)],
    ['Thấp', fmtNumber(c.low)],
    ['Đóng', fmtNumber(c.close)],
    ['Khối lượng', fmtNumber(c.volume)],
  ]
  return (
    <div
      className="rounded-md px-3 py-2 text-[11px]"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        boxShadow: '0 8px 24px -12px rgba(0,0,0,0.4)',
      }}
    >
      <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        {c.time}
      </p>
      <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <span style={{ color: 'var(--text-faint)' }}>{k}</span>
            <span
              className="text-right tabular-nums font-medium"
              style={{ color: k === 'Khối lượng' ? 'var(--text-secondary)' : up ? UP : DOWN }}
            >
              {v}
            </span>
          </div>
        ))}
        {c.ma20 != null && (
          <div className="contents">
            <span style={{ color: MA_COLORS[20] }}>MA20</span>
            <span className="text-right tabular-nums" style={{ color: MA_COLORS[20] }}>
              {fmtNumber(Math.round(c.ma20))}
            </span>
          </div>
        )}
        {c.ma50 != null && (
          <div className="contents">
            <span style={{ color: MA_COLORS[50] }}>MA50</span>
            <span className="text-right tabular-nums" style={{ color: MA_COLORS[50] }}>
              {fmtNumber(Math.round(c.ma50))}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function ToggleButton({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5"
      style={
        active
          ? { background: 'rgba(37,99,235,0.18)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.32)' }
          : { color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }
      }
    >
      {children}
    </button>
  )
}

/** Dải tổng quan dưới biểu đồ: toàn bộ lịch sử giá thu nhỏ, kèm khung sáng cho
 *  biết đang xem đoạn nào. Kéo khung để trượt, kéo hai mép để co giãn.
 *
 *  Đây là thứ khiến việc phóng to không bị "lạc": người dùng luôn thấy mình
 *  đang đứng ở đâu trong toàn bộ chuỗi thời gian. */
function OverviewStrip({
  candles,
  start,
  end,
  onChange,
}: {
  candles: Candle[]
  start: number
  end: number
  onChange: (start: number, end: number) => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ mode: 'move' | 'left' | 'right'; originX: number; s: number; e: number } | null>(null)

  const total = candles.length
  const leftPct = (start / total) * 100
  const widthPct = ((end - start + 1) / total) * 100

  const path = useMemo(() => {
    if (candles.length < 2) return ''
    const lo = Math.min(...candles.map((c) => c.low))
    const hi = Math.max(...candles.map((c) => c.high))
    const span = hi - lo || 1
    return candles
      .map((c, i) => {
        const x = (i / (candles.length - 1)) * 100
        const y = 100 - ((c.close - lo) / span) * 100
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
      })
      .join(' ')
  }, [candles])

  const onPointerDown = (mode: 'move' | 'left' | 'right') => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { mode, originX: e.clientX, s: start, e: end }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    const el = ref.current
    if (!d || !el) return
    const width = el.clientWidth || 1
    const deltaIdx = Math.round(((e.clientX - d.originX) / width) * total)

    if (d.mode === 'move') {
      const span = d.e - d.s
      let s = d.s + deltaIdx
      s = Math.max(0, Math.min(total - 1 - span, s))
      onChange(s, s + span)
    } else if (d.mode === 'left') {
      const s = Math.max(0, Math.min(d.e - MIN_VISIBLE + 1, d.s + deltaIdx))
      onChange(s, d.e)
    } else {
      const en = Math.min(total - 1, Math.max(d.s + MIN_VISIBLE - 1, d.e + deltaIdx))
      onChange(d.s, en)
    }
  }

  const onPointerUp = () => {
    drag.current = null
  }

  return (
    <div
      ref={ref}
      className="relative mt-1.5 rounded-lg overflow-hidden select-none"
      style={{ height: 34, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d={path} fill="none" stroke="#94a3b8" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      </svg>

      {/* Vùng ngoài khung nhìn bị làm mờ, giống dải chọn khoảng của bảng giá */}
      <div className="absolute inset-y-0 left-0" style={{ width: `${leftPct}%`, background: 'rgba(15,23,42,0.28)' }} />
      <div
        className="absolute inset-y-0 right-0"
        style={{ width: `${Math.max(0, 100 - leftPct - widthPct)}%`, background: 'rgba(15,23,42,0.28)' }}
      />

      <div
        className="absolute inset-y-0 cursor-grab active:cursor-grabbing"
        style={{
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          border: '1px solid rgba(37,99,235,0.7)',
          background: 'rgba(37,99,235,0.10)',
        }}
        onPointerDown={onPointerDown('move')}
        role="slider"
        aria-label="Khoảng thời gian đang xem"
        aria-valuemin={0}
        aria-valuemax={total - 1}
        aria-valuenow={start}
      >
        <span
          className="absolute inset-y-0 -left-1 w-2 cursor-ew-resize"
          onPointerDown={onPointerDown('left')}
          aria-hidden="true"
        />
        <span
          className="absolute inset-y-0 -right-1 w-2 cursor-ew-resize"
          onPointerDown={onPointerDown('right')}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

export interface PriceChartProps {
  candles: Candle[]
  height?: number
  volumeHeight?: number
  /** Kiểu mặc định khi mở. Người dùng vẫn đổi được bằng thanh công cụ. */
  defaultType?: ChartType
  showToolbar?: boolean
}

export default function PriceChart({
  candles,
  height = 300,
  volumeHeight = 90,
  defaultType = 'candle',
  showToolbar = true,
}: PriceChartProps) {
  const [type, setType] = useState<ChartType>(defaultType)
  const [showVolume, setShowVolume] = useState(true)
  const [mas, setMas] = useState<number[]>([20])

  // Khoảng nến đang hiển thị. Phóng to/thu nhỏ và kéo ngang đều chỉ là thay
  // đổi cặp chỉ số này.
  const [range, setRange] = useState<[number, number]>([0, Math.max(0, candles.length - 1)])
  const [crosshair, setCrosshair] = useState<{ y: number; price: number } | null>(null)

  const plotRef = useRef<HTMLDivElement | null>(null)
  const pan = useRef<{ x: number; start: number; end: number } | null>(null)
  const pinch = useRef<{ distance: number; start: number; end: number } | null>(null)

  // Trung bình động tính trên TOÀN BỘ chuỗi rồi mới cắt cửa sổ. Nếu tính sau
  // khi cắt, MA20 ở đầu cửa sổ sẽ trống 19 phiên và đường vẽ ra sai.
  const full = useMemo<ChartCandle[]>(() => {
    const ma20 = movingAverage(candles, 20)
    const ma50 = movingAverage(candles, 50)
    return candles.map((c, i) => ({ ...c, range: [c.low, c.high], ma20: ma20[i], ma50: ma50[i] }))
  }, [candles])

  // Dữ liệu mới (đổi mã, đổi khoảng thời gian) thì xem lại từ đầu.
  useEffect(() => {
    setRange([0, Math.max(0, candles.length - 1)])
  }, [candles])

  const [start, end] = range
  const visible = useMemo(() => full.slice(start, end + 1), [full, start, end])

  // Trục giá bám sát phần ĐANG XEM, không phải toàn bộ chuỗi — đó là điều làm
  // cho việc phóng to có ý nghĩa: càng phóng, biến động nhỏ càng hiện rõ.
  const [yMin, yMax] = useMemo(() => {
    if (!visible.length) return [0, 1]
    const lo = Math.min(...visible.map((c) => c.low))
    const hi = Math.max(...visible.map((c) => c.high))
    const pad = (hi - lo) * 0.08 || hi * 0.02
    return [Math.max(0, lo - pad), hi + pad]
  }, [visible])

  const clampRange = useCallback(
    (s: number, e: number): [number, number] => {
      const last = full.length - 1
      let ns = Math.max(0, Math.round(s))
      let ne = Math.min(last, Math.round(e))
      if (ne - ns + 1 < MIN_VISIBLE) {
        const mid = (ns + ne) / 2
        ns = Math.max(0, Math.round(mid - MIN_VISIBLE / 2))
        ne = Math.min(last, ns + MIN_VISIBLE - 1)
        ns = Math.max(0, ne - MIN_VISIBLE + 1)
      }
      return [ns, ne]
    },
    [full.length],
  )

  /** Phóng quanh một vị trí tương đối (0 = mép trái, 1 = mép phải).
   *  Giữ nguyên điểm dưới con trỏ, giống mọi bảng giá. */
  const zoomAt = useCallback(
    (factor: number, anchor: number) => {
      setRange(([s, e]) => {
        const span = e - s + 1
        const newSpan = Math.max(MIN_VISIBLE, Math.min(full.length, Math.round(span * factor)))
        const pivot = s + anchor * span
        const ns = pivot - anchor * newSpan
        return clampRange(ns, ns + newSpan - 1)
      })
    },
    [full.length, clampRange],
  )

  // Bánh xe chuột: phải đăng ký thủ công với passive:false, nếu không trình
  // duyệt chặn preventDefault và cả trang sẽ cuộn thay vì biểu đồ phóng to.
  useEffect(() => {
    const el = plotRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const plotLeft = rect.left + Y_AXIS_WIDTH
      const plotWidth = Math.max(1, rect.width - Y_AXIS_WIDTH - PLOT.right)
      const anchor = Math.min(1, Math.max(0, (e.clientX - plotLeft) / plotWidth))
      zoomAt(e.deltaY > 0 ? 1.18 : 1 / 1.18, anchor)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    pan.current = { x: e.clientX, start, end }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const el = plotRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()

    // Đường ngang của crosshair kèm nhãn giá bên phải.
    const plotTop = PLOT.top
    const plotBottom = rect.height - X_AXIS_HEIGHT
    const y = e.clientY - rect.top
    if (y >= plotTop && y <= plotBottom && plotBottom > plotTop) {
      const ratio = (y - plotTop) / (plotBottom - plotTop)
      setCrosshair({ y, price: yMax - ratio * (yMax - yMin) })
    } else {
      setCrosshair(null)
    }

    const p = pan.current
    if (!p) return
    const plotWidth = Math.max(1, rect.width - Y_AXIS_WIDTH - PLOT.right)
    const span = p.end - p.start + 1
    // Kéo sang phải = lùi về quá khứ, giống mọi bảng giá.
    const shift = Math.round(((p.x - e.clientX) / plotWidth) * span)
    if (shift === 0) return
    const last = full.length - 1
    let s = p.start + shift
    s = Math.max(0, Math.min(last - span + 1, s))
    setRange([s, s + span - 1])
  }

  const endPan = () => {
    pan.current = null
    pinch.current = null
  }

  // Chụm hai ngón để phóng trên điện thoại.
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 2) return
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    const distance = Math.hypot(dx, dy)
    if (!pinch.current) {
      pinch.current = { distance, start, end }
      return
    }
    const factor = pinch.current.distance / distance
    const span = pinch.current.end - pinch.current.start + 1
    const newSpan = Math.max(MIN_VISIBLE, Math.min(full.length, Math.round(span * factor)))
    const mid = (pinch.current.start + pinch.current.end) / 2
    setRange(clampRange(mid - newSpan / 2, mid + newSpan / 2))
  }

  if (!candles.length) {
    return (
      <p className="text-[12px] py-16 text-center" style={{ color: 'var(--text-faint)' }}>
        Chưa có dữ liệu lịch sử giá
      </p>
    )
  }

  const toggleMa = (period: number) =>
    setMas((prev) => (prev.includes(period) ? prev.filter((p) => p !== period) : [...prev, period]))

  const zoomedIn = end - start + 1 < full.length

  return (
    <div>
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {CHART_TYPES.map(({ key, label, icon: Icon }) => (
            <ToggleButton key={key} active={type === key} onClick={() => setType(key)}>
              <Icon size={12} />
              {label}
            </ToggleButton>
          ))}

          <span className="w-px h-5 mx-1" style={{ background: 'var(--border-subtle)' }} />

          {[20, 50].map((p) => (
            <ToggleButton
              key={p}
              active={mas.includes(p)}
              onClick={() => toggleMa(p)}
              title={`Đường giá trung bình ${p} phiên gần nhất`}
            >
              <span
                className="w-2 h-0.5 rounded"
                style={{ background: mas.includes(p) ? MA_COLORS[p] : 'currentColor' }}
              />
              MA{p}
            </ToggleButton>
          ))}

          <ToggleButton active={showVolume} onClick={() => setShowVolume((v) => !v)}>
            Khối lượng
          </ToggleButton>

          <span className="w-px h-5 mx-1" style={{ background: 'var(--border-subtle)' }} />

          <button
            onClick={() => zoomAt(1 / 1.4, 0.5)}
            title="Phóng to"
            aria-label="Phóng to biểu đồ"
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
          >
            <PlusIcon size={12} />
          </button>
          <button
            onClick={() => zoomAt(1.4, 0.5)}
            title="Thu nhỏ"
            aria-label="Thu nhỏ biểu đồ"
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
          >
            <MinusIcon size={12} />
          </button>
          <button
            onClick={() => setRange([0, full.length - 1])}
            disabled={!zoomedIn}
            title="Xem lại toàn bộ"
            aria-label="Xem lại toàn bộ khoảng thời gian"
            className="p-1.5 rounded-lg disabled:opacity-40"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
          >
            <Maximize2 size={12} />
          </button>

          <span className="text-[11px] ml-1 tabular-nums" style={{ color: 'var(--text-faint)' }}>
            {visible.length}/{full.length} phiên
          </span>
        </div>
      )}

      <div
        ref={plotRef}
        className="relative select-none"
        style={{ cursor: pan.current ? 'grabbing' : 'crosshair', touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerLeave={() => {
          endPan()
          setCrosshair(null)
        }}
        onTouchMove={onTouchMove}
        onTouchEnd={endPan}
        onDoubleClick={() => setRange([0, full.length - 1])}
      >
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={visible} margin={PLOT}>
            <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="time"
              height={X_AXIS_HEIGHT}
              tick={{ fill: 'var(--text-faint)', fontSize: 10 }}
              minTickGap={40}
              axisLine={{ stroke: 'var(--border-subtle)' }}
              tickLine={false}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fill: 'var(--text-faint)', fontSize: 10 }}
              width={Y_AXIS_WIDTH}
              tickFormatter={(v) => fmtNumber(Math.round(v))}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: 'var(--text-faint)', strokeWidth: 1, strokeDasharray: '3 3' }}
            />

            {type === 'candle' && <Bar dataKey="range" shape={CandleShape as never} isAnimationActive={false} />}
            {type === 'ohlc' && <Bar dataKey="range" shape={OhlcShape as never} isAnimationActive={false} />}
            {type === 'bar' && (
              <Bar dataKey="close" isAnimationActive={false} radius={[2, 2, 0, 0]}>
                {visible.map((c, i) => (
                  <Cell key={i} fill={c.close >= c.open ? UP : DOWN} />
                ))}
              </Bar>
            )}
            {type === 'line' && (
              <Line type="monotone" dataKey="close" stroke="#2563eb" strokeWidth={1.6} dot={false} isAnimationActive={false} />
            )}
            {type === 'area' && (
              <>
                <defs>
                  <linearGradient id="priceArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke="#2563eb"
                  strokeWidth={1.6}
                  fill="url(#priceArea)"
                  isAnimationActive={false}
                />
              </>
            )}

            {mas.map((p) => (
              <Line
                key={p}
                type="monotone"
                dataKey={p === 20 ? 'ma20' : 'ma50'}
                stroke={MA_COLORS[p]}
                strokeWidth={1.3}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Đường ngang theo con trỏ kèm mức giá — recharts chỉ vẽ sẵn đường dọc */}
        {crosshair && (
          <>
            <div
              className="absolute pointer-events-none"
              style={{
                top: crosshair.y,
                left: Y_AXIS_WIDTH,
                right: PLOT.right,
                borderTop: '1px dashed var(--text-faint)',
                opacity: 0.7,
              }}
            />
            <div
              className="absolute pointer-events-none text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded"
              style={{
                top: crosshair.y - 9,
                left: 2,
                width: Y_AXIS_WIDTH - 6,
                textAlign: 'right',
                background: 'var(--text-secondary)',
                color: 'var(--bg-card)',
              }}
            >
              {fmtNumber(Math.round(crosshair.price))}
            </div>
          </>
        )}
      </div>

      {showVolume && (
        <ResponsiveContainer width="100%" height={volumeHeight}>
          <ComposedChart data={visible} margin={{ top: 4, right: PLOT.right, left: 0, bottom: 0 }}>
            <XAxis dataKey="time" hide />
            <YAxis width={Y_AXIS_WIDTH} hide />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
            <Bar dataKey="volume" isAnimationActive={false}>
              {visible.map((c, i) => (
                <Cell key={i} fill={c.close >= c.open ? UP : DOWN} fillOpacity={0.55} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {full.length > MIN_VISIBLE && (
        <OverviewStrip
          candles={candles}
          start={start}
          end={end}
          onChange={(s, e) => setRange(clampRange(s, e))}
        />
      )}

      <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-faint)' }}>
        Lăn chuột để phóng to · kéo ngang để xem đoạn khác · nhấp đúp để xem lại toàn bộ · kéo khung
        sáng bên dưới để chọn khoảng
      </p>
    </div>
  )
}
