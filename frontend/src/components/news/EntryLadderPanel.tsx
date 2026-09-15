import { Target } from 'lucide-react'
import { useModelInfo } from '../../hooks/useModelInfo'
import type { EntryLadder, EntryLadderCell } from '../../types'
import { useLanguage } from '../../context/LanguageContext'

const VOLATILITY_KEYS = ['LOW', 'MID', 'HIGH'] as const
const BAND_KEYS = ['LOW', 'MEDIUM', 'HIGH'] as const
// Giá tham chiếu từ mô hình tính theo nghìn đồng; hiển thị theo đồng cho khớp
// với trang cổ phiếu và vùng giá tham khảo.
const PANEL_TO_VND = 1000

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
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 0 })
}

type Pick = { cell: EntryLadderCell; volatility: (typeof VOLATILITY_KEYS)[number] | null; band: (typeof BAND_KEYS)[number]; exact: boolean }

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
  const { t } = useLanguage()
  const info = useModelInfo()
  const ladder = info?.entry_ladder
  const VOLATILITY_LABEL: Record<(typeof VOLATILITY_KEYS)[number], string> = {
    LOW: t('entryLadder.volatilityLabel.LOW'),
    MID: t('entryLadder.volatilityLabel.MID'),
    HIGH: t('entryLadder.volatilityLabel.HIGH'),
  }
  const BAND_LABEL: Record<(typeof BAND_KEYS)[number], string> = {
    LOW: t('entryLadder.bandLabel.LOW'),
    MEDIUM: t('entryLadder.bandLabel.MEDIUM'),
    HIGH: t('entryLadder.bandLabel.HIGH'),
  }
  if (!ladder?.cells?.ALL) return null

  const pLarge = 1 - (probabilities.NEUTRAL ?? 0)
  const chosen = pick(ladder, volatility, pLarge)
  const levels = Object.entries(chosen.cell.levels)
    .map(([key, value]) => ({ level: Number(key), ...value }))
    .filter((row) => Number.isFinite(row.level) && row.fill_rate != null)
    .sort((a, b) => b.level - a.level)

  const market = chosen.cell.market_at_next_open.mean_net_if_filled
  const rows = [
    ...(market != null ? [{ key: 'open', label: t('entryLadder.buyAtNextOpen'), at: null as number | null, fill: 1, net: market }] : []),
    ...levels.map((row) => ({
      key: String(row.level),
      label: row.level === 0 ? t('entryLadder.buyAtReference') : t('entryLadder.buyBelowReference', { pct: pct(-row.level) }),
      at: referenceClose != null ? referenceClose * PANEL_TO_VND * (1 + row.level) : null,
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
      aria-label={t('entryLadder.ariaLabel')}
      className="rounded-xl p-3 mt-2 space-y-2"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: 'var(--text-faint)' }}>
        <Target size={12} /> {t('entryLadder.heading')}
      </p>
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {t('entryLadder.comparedToReference')}
        {referenceClose != null && (
          <>
            {' '}
            <strong style={{ color: 'var(--text-primary)' }}>{price(referenceClose * PANEL_TO_VND)}</strong> ({t('entryLadder.thousandDong')}
            {referenceSession ? t('entryLadder.closeOfSession', { session: referenceSession }) : ''})
          </>
        )}
        . {t('entryLadder.comparisonGroup')}{' '}
        {chosen.volatility
          ? `${t('entryLadder.groupVolatility', { volatility: VOLATILITY_LABEL[chosen.volatility] })}${
              chosen.exact ? t('entryLadder.groupExpectedBand', { band: BAND_LABEL[chosen.band] }) : ''
            }`
          : t('entryLadder.groupAll')}{' '}
        {t('entryLadder.observationsCount', { count: chosen.cell.events.toLocaleString('vi-VN') })}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px] tabular-nums">
          <thead>
            <tr style={{ color: 'var(--text-faint)' }}>
              <th className="text-left font-medium py-1 pr-2">{t('entryLadder.colEntryMethod')}</th>
              <th className="text-right font-medium py-1 px-2">{t('entryLadder.colPrice')}</th>
              <th className="text-right font-medium py-1 px-2">{t('entryLadder.colFillRate', { sessions: ladder.sessions })}</th>
              <th className="text-right font-medium py-1 pl-2">{t('entryLadder.colNetProfit')}</th>
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
          ? t('entryLadder.anyProfitNotice')
          : t('entryLadder.noProfitNotice', {
              waitingNote: waitingLosesLess ? t('entryLadder.waitingLosesLessNote') : '',
            })}
      </p>
      <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
        {t('entryLadder.footerNote', {
          trainedUntil: ladder.validation.trained_until,
          checkedOn: ladder.validation.checked_on,
          errorNote:
            error != null
              ? t('entryLadder.errorNote', { error: (error * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) })
              : '',
          sessions: ladder.sessions,
          cost: pct(ladder.round_trip_cost, 1),
        })}
      </p>
    </section>
  )
}
