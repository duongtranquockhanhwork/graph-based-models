import { Ruler, ShieldAlert } from 'lucide-react'
import type { PriceBand } from '../../types'
import { fmtNumber } from '../../utils/stockColors'

/** Vùng giá tham khảo tính từ dữ liệu lịch sử thật — một quy tắc thống kê mô
 *  tả (đo lại biến động đã xảy ra), KHÔNG phải một mô hình dự đoán đã được
 *  kiểm định. Khác hẳn RecommendationPanel/EntryLadderPanel — những panel đó
 *  đo trên dữ liệu 2026 hệ thống chưa từng thấy; panel này không có gì để đo,
 *  nên phải nói rõ ràng ngay trong giao diện, không chỉ trong tooltip. */
export default function PriceBandPanel({ band, loading }: { band: PriceBand | null; loading: boolean }) {
  if (loading) return <div className="skeleton h-24 rounded-xl" />
  if (!band) return null

  const rangeSpan = band.range_high - band.range_low
  const pct = (value: number) => (rangeSpan > 0 ? ((value - band.range_low) / rangeSpan) * 100 : 50)

  return (
    <div
      className="rounded-xl p-3.5 space-y-3"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-center gap-2">
        <Ruler size={14} style={{ color: 'var(--text-faint)' }} />
        <h4 className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          Vùng giá tham khảo ({band.sessions_used} phiên gần nhất)
        </h4>
      </div>

      <div className="relative h-2 rounded-full" style={{ background: 'var(--bg-surface)' }}>
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full"
          style={{ left: `${Math.max(0, Math.min(100, pct(band.current_price)))}%`, background: '#2563eb' }}
          title={`Giá hiện tại: ${fmtNumber(band.current_price)}`}
        />
        {band.pullback_reference_price < band.current_price && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full border"
            style={{
              left: `${Math.max(0, Math.min(100, pct(band.pullback_reference_price)))}%`,
              background: 'var(--bg-card)',
              borderColor: '#b45309',
            }}
            title={`Mốc chờ giảm về: ${fmtNumber(band.pullback_reference_price)}`}
          />
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
        <span>{fmtNumber(band.range_low)}</span>
        <span>{fmtNumber(band.range_high)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div>
          <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
            Độ lệch chuẩn lợi suất ngày
          </p>
          <p className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {band.daily_volatility_pct.toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
            Nếu chờ giá giảm ~2 độ lệch chuẩn
          </p>
          <p className="text-[13px] font-semibold tabular-nums" style={{ color: '#b45309' }}>
            {fmtNumber(band.pullback_reference_price)}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-1.5 pt-1">
        <ShieldAlert size={12} className="mt-0.5 flex-shrink-0" style={{ color: '#b45309' }} />
        <p className="text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
          {band.disclaimer}
        </p>
      </div>
    </div>
  )
}
