import { Target } from 'lucide-react'
import { useModelInfo } from '../../hooks/useModelInfo'
import type { EntryLadder, EntryLadderCell } from '../../types'

const VOLATILITY_LABEL = { LOW: 'thấp', MID: 'vừa', HIGH: 'cao' } as const
const BAND_LABEL = { LOW: 'thấp', MEDIUM: 'trung bình', HIGH: 'cao' } as const

function pct(value: number, digits = 0): string {
  return `${(value * 100).toLocaleString('vi-VN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`
}

function signed(value: number): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${pct(Math.abs(value), 2)}`
}

function price(value: number): string {
  return value.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type Pick = { cell: EntryLadderCell; volatility: keyof typeof VOLATILITY_LABEL | null; band: keyof typeof BAND_LABEL; exact: boolean }

/** Nhóm sự kiện giống bài này nhất mà vẫn đủ số lần quan sát: cùng mức biến
 *  động trước tin và cùng mức biến động mô hình dự kiến; thiếu dữ liệu thì lùi
 *  về nhóm chỉ theo biến động, rồi về toàn bộ. */
function pick(ladder: EntryLadder, volatility: number | null, pLarge: number): Pick {
  const [v1, v2] = ladder.volatility_cuts
  const vol = volatility == null ? null : volatility < v1 ? 'LOW' : volatility < v2 ? 'MID' : 'HIGH'
  const [b1, b2] = ladder.band_edges
  const band = pLarge < b1 ? 'LOW' : pLarge < b2 ? 'MEDIUM' : 'HIGH'
  const exact = vol ? ladder.cells[`VOL_${vol}|BAND_${band}`] : undefined
  if (exact?.reliable) return { cell: exact, volatility: vol, band, exact: true }
  const byVolatility = vol ? ladder.cells[`VOL_${vol}`] : undefined
  if (byVolatility?.reliable) return { cell: byVolatility, volatility: vol, band, exact: false }
  return { cell: ladder.cells.ALL, volatility: null, band, exact: false }
}

/** "Nếu vẫn muốn mua thì mua ở giá nào?" — trả lời bằng điều đã xảy ra, không
 *  bằng một dự đoán.
 *
 *  Mô hình không đoán được chiều giá, nên nó không có tư cách nói "mua ở X". Thứ
 *  dữ liệu nói được, và đã kiểm trên 2026: với lệnh đặt mua ở từng mức thấp hơn
 *  giá tham chiếu, lệnh khớp bao nhiêu phần trăm số lần trong 3 phiên, và khi
 *  khớp thì lãi/lỗ sau phí ra sao. Panel chỉ đọc số từ `entry_ladder`; chưa có
 *  số thì không hiện.
 */
export default function EntryLadderPanel({
  probabilities,
  volatility,
  referenceClose,
  referenceSession,
}: {
  probabilities: Record<string, number>
  volatility: number | null
  referenceClose: number | null
  referenceSession: string | null
}) {
  const info = useModelInfo()
  const ladder = info?.entry_ladder
  if (!ladder?.cells?.ALL) return null

  const pLarge = 1 - (probabilities.NEUTRAL ?? 0)
  const chosen = pick(ladder, volatility, pLarge)
  const levels = Object.entries(chosen.cell.levels)
    .map(([key, value]) => ({ level: Number(key), ...value }))
    .filter((row) => Number.isFinite(row.level) && row.fill_rate != null)
    .sort((a, b) => b.level - a.level)

  const market = chosen.cell.market_at_next_open.mean_net_if_filled
  const rows = [
    ...(market != null ? [{ key: 'open', label: 'Mua khi mở cửa phiên kế tiếp', at: null as number | null, fill: 1, net: market }] : []),
    ...levels.map((row) => ({
      key: String(row.level),
      label: row.level === 0 ? 'Đặt mua đúng giá tham chiếu' : `Đặt mua thấp hơn ${pct(-row.level)}`,
      at: referenceClose != null ? referenceClose * (1 + row.level) : null,
      fill: row.fill_rate as number,
      net: row.mean_net_if_filled ?? null,
    })),
  ]
  const nets = rows.map((r) => r.net).filter((n): n is number => n != null)
  const anyProfit = nets.some((n) => n > 0)
  const deepest = levels.length ? levels[levels.length - 1] : null
  const waitingLosesLess = market != null && deepest?.mean_net_if_filled != null && deepest.mean_net_if_filled > market
  const error = ladder.validation.mean_abs_fill_rate_error

  return (
    <section
      aria-label="Mua ở giá nào thì được gì"
      className="rounded-xl p-3 mt-2 space-y-2"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: 'var(--text-faint)' }}>
        <Target size={12} /> Mua ở giá nào thì được gì — theo dữ liệu đã xảy ra
      </p>
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        So với giá tham chiếu
        {referenceClose != null && (
          <>
            {' '}
            <strong style={{ color: 'var(--text-primary)' }}>{price(referenceClose)}</strong> (nghìn đồng
            {referenceSession ? `, đóng cửa phiên ${referenceSession}` : ''})
          </>
        )}
        . Nhóm so sánh:{' '}
        {chosen.volatility
          ? `mã có biến động trước tin ${VOLATILITY_LABEL[chosen.volatility]}${
              chosen.exact ? `, mức biến động dự kiến ${BAND_LABEL[chosen.band]}` : ''
            }`
          : 'mọi sự kiện'}{' '}
        — {chosen.cell.events.toLocaleString('vi-VN')} lần quan sát.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px] tabular-nums">
          <thead>
            <tr style={{ color: 'var(--text-faint)' }}>
              <th className="text-left font-medium py-1 pr-2">Cách vào lệnh</th>
              <th className="text-right font-medium py-1 px-2">Giá</th>
              <th className="text-right font-medium py-1 px-2">Khớp trong {ladder.sessions} phiên</th>
              <th className="text-right font-medium py-1 pl-2">Lãi/lỗ TB sau phí khi khớp</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <td className="py-1 pr-2">{row.label}</td>
                <td className="text-right py-1 px-2">{row.at != null ? price(row.at) : '—'}</td>
                <td className="text-right py-1 px-2">{pct(row.fill)}</td>
                <td className="text-right py-1 pl-2" style={{ color: row.net != null && row.net < 0 ? '#b45309' : 'var(--text-secondary)' }}>
                  {row.net != null ? signed(row.net) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
        {anyProfit
          ? 'Có mức giá cho lãi trung bình dương ở nhóm này, nhưng khi xét hàng chục nhóm cùng lúc, vài nhóm dương là điều ngẫu nhiên cũng tạo ra được — đừng coi đó là tín hiệu.'
          : `Không mức giá nào cho lãi trung bình sau phí ở nhóm này.${
              waitingLosesLess
                ? ' Chờ giá thấp hơn làm khoản lỗ trung bình nhỏ lại, đổi lại lệnh ít khi khớp hơn.'
                : ''
            }`}
      </p>
      <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
        Tỉ lệ khớp ước lượng trên dữ liệu tới {ladder.validation.trained_until} và kiểm lại trên năm{' '}
        {ladder.validation.checked_on}
        {error != null ? `: lệch trung bình ${(error * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} điểm %` : ''}.
        Lệnh khớp ở phiên đầu tiên có giá thấp nhất chạm mức đặt; lãi/lỗ tính tới giá đóng cửa phiên thứ{' '}
        {ladder.sessions}, sau phí mua bán {pct(ladder.round_trip_cost, 1)}. Số liệu mô tả điều đã xảy ra, không phải
        lời khuyên đầu tư.
      </p>
    </section>
  )
}
