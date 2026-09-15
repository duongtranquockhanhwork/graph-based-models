import { Ruler, ShieldAlert, Target } from 'lucide-react'
import type { PriceBand } from '../../types'
import { fmtNumber } from '../../utils/stockColors'
import { useLanguage } from '../../context/LanguageContext'

const VOLATILITY_LABEL = { LOW: 'thấp', MID: 'vừa', HIGH: 'cao' } as const

function pct(value: number, digits = 0): string {
  return `${(value * 100).toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`
}

function signedPct(value: number): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${pct(Math.abs(value), 2)}`
}

/** Vùng giá tham khảo tính từ dữ liệu lịch sử thật — một quy tắc thống kê mô
 *  tả, KHÔNG phải mô hình dự đoán. Giá lấy từ cùng bảng giá mô hình dùng (khi
 *  có) và hiển thị theo đồng như phần còn lại của trang. Mốc "chờ giá giảm về"
 *  không bao giờ đứng một mình: nó đi kèm số liệu đã kiểm chứng của bảng giá
 *  vào lệnh cho đúng mức đặt lệnh gần nhất. */
export default function PriceBandPanel({ band, loading }: { band: PriceBand | null; loading: boolean }) {
  const { t } = useLanguage()
  if (loading) return <div className="skeleton h-24 rounded-xl" />
  if (!band) return null

  const rangeSpan = band.range_high - band.range_low
  const position = (value: number) => (rangeSpan > 0 ? ((value - band.range_low) / rangeSpan) * 100 : 50)
  const entry = band.validated_entry
  const source =
    band.price_source === 'model_panel' ? 'cùng bảng giá mô hình dự đoán đang dùng' : 'lịch sử giá vnstock'

  return (
    <div
      className="rounded-xl p-3.5 space-y-3"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-center gap-2">
        <Ruler size={14} style={{ color: 'var(--text-faint)' }} />
        <h4 className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('priceBand.title', { sessions: band.sessions_used })}
        </h4>
      </div>

      <div className="relative h-2 rounded-full" style={{ background: 'var(--bg-surface)' }}>
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full"
          style={{ left: `${Math.max(0, Math.min(100, position(band.current_price)))}%`, background: '#2563eb' }}
          title={t('priceBand.currentPriceTooltip', { price: fmtNumber(band.current_price) })}
        />
        {band.pullback_reference_price < band.current_price && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full border"
            style={{
              left: `${Math.max(0, Math.min(100, position(band.pullback_reference_price)))}%`,
              background: 'var(--bg-card)',
              borderColor: '#b45309',
            }}
            title={t('priceBand.pullbackTooltip', { price: fmtNumber(band.pullback_reference_price) })}
          />
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
        <span>{fmtNumber(band.range_low)} đ</span>
        <span>{fmtNumber(band.range_high)} đ</span>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div>
          <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
            {t('priceBand.dailyVolatility')}
          </p>
          <p className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {band.daily_volatility_pct.toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
            {t('priceBand.pullback2Sigma')}
          </p>
          <p className="text-[13px] font-semibold tabular-nums" style={{ color: '#b45309' }}>
            {fmtNumber(band.pullback_reference_price)} đ
          </p>
        </div>
      </div>

      {entry && (
        <div className="rounded-lg p-2.5 space-y-1" style={{ background: 'var(--bg-surface)' }}>
          <p className="text-[11px] font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
            <Target size={12} style={{ color: 'var(--text-faint)' }} /> Đối chiếu số liệu đã kiểm chứng
          </p>
          <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            Lệnh đặt mua{' '}
            {entry.order_level === 0
              ? 'đúng giá đóng cửa gần nhất'
              : `thấp hơn ${pct(-entry.order_level)} so với giá đóng cửa gần nhất`}{' '}
            (mức gần mốc này nhất) đã khớp <strong>{pct(entry.fill_rate)}</strong> số lần trong {entry.sessions} phiên;
            khi khớp, lãi/lỗ trung bình{' '}
            <strong
              style={{
                color: entry.mean_net_if_filled != null && entry.mean_net_if_filled < 0 ? '#b45309' : 'var(--text-primary)',
              }}
            >
              {entry.mean_net_if_filled != null ? signedPct(entry.mean_net_if_filled) : '—'}
            </strong>{' '}
            sau phí {pct(entry.round_trip_cost, 1)}.
          </p>
          <p className="text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
            {entry.volatility_group ? `Nhóm mã có biến động ${VOLATILITY_LABEL[entry.volatility_group]}` : 'Mọi sự kiện'}
            {entry.events != null ? ` · ${entry.events.toLocaleString('vi-VN')} lần quan sát` : ''} · ước lượng tới{' '}
            {entry.trained_until ?? '—'}, kiểm lại trên năm {entry.checked_on ?? '—'}.
          </p>
        </div>
      )}

      <p className="text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
        Giá lấy từ {source}, phiên {band.as_of_session ?? '—'}; đơn vị: đồng.
      </p>

      <div className="flex items-start gap-1.5">
        <ShieldAlert size={12} className="mt-0.5 flex-shrink-0" style={{ color: '#b45309' }} />
        <p className="text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
          {band.disclaimer}
        </p>
      </div>
    </div>
  )
}
