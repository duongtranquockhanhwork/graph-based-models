import { Link } from 'react-router-dom'
import { Ban, Minus, TrendingDown, TrendingUp } from 'lucide-react'

/** Từ vựng dùng chung cho toàn ứng dụng.
 *
 * Trước đây mỗi trang tự định nghĩa nhãn sự kiện và màu cảm xúc của riêng nó,
 * nên cùng một sự kiện hiện ra ba cách khác nhau ở ba trang. Gom về một nơi để
 * người dùng học một lần rồi đọc được ở mọi chỗ.
 */
export const EVENT_LABELS: Record<string, string> = {
  profit_growth: 'Lợi nhuận tăng',
  profit_decline: 'Lợi nhuận giảm',
  dividend: 'Chia cổ tức',
  merger: 'Sáp nhập/mua lại',
  new_contract: 'Hợp đồng/trúng thầu',
  penalty: 'Vi phạm/xử phạt',
  leadership_change: 'Thay đổi lãnh đạo',
  share_issuance: 'Phát hành cổ phiếu',
  expansion: 'Mở rộng đầu tư',
}

export const SENTIMENT_LABELS: Record<string, string> = {
  Positive: 'Tin tốt',
  Negative: 'Tin xấu',
  Neutral: 'Tin trung tính',
}

export const SENTIMENT_COLORS: Record<string, string> = {
  Positive: '#0b7d5a',
  Negative: '#c0392e',
  Neutral: '#64748b',
}

export const TREND_LABELS: Record<string, string> = {
  INCREASING: 'Có thể tăng',
  DECREASING: 'Có thể giảm',
  UNCHANGED: 'Ít biến động',
}

export const TREND_COLORS: Record<string, string> = {
  INCREASING: '#0b7d5a',
  DECREASING: '#c0392e',
  UNCHANGED: '#64748b',
}

const TREND_ICONS = {
  INCREASING: TrendingUp,
  DECREASING: TrendingDown,
  UNCHANGED: Minus,
}

/** Mã cổ phiếu — LUÔN dẫn tới hồ sơ mã.
 *
 * Đây là mắt xích chính nối các trang lại với nhau: bất kỳ mã nào xuất hiện ở
 * bất kỳ đâu (dòng tin, dự đoán, đồ thị, bảng giá) đều bấm được để đi tới một
 * nơi duy nhất mô tả đầy đủ về mã đó.
 */
export function SymbolChip({
  symbol,
  size = 'md',
  muted = false,
}: {
  symbol: string
  size?: 'sm' | 'md'
  muted?: boolean
}) {
  return (
    <Link
      to={`/stocks/${symbol}`}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center rounded font-semibold tracking-wide transition-colors ${
        size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'
      }`}
      style={{
        background: muted ? 'var(--bg-surface)' : 'rgba(37,99,235,0.10)',
        color: muted ? 'var(--text-muted)' : '#2563eb',
        border: `1px solid ${muted ? 'var(--border-subtle)' : 'rgba(37,99,235,0.20)'}`,
      }}
      title={`Xem thông tin cổ phiếu ${symbol}`}
    >
      {symbol}
    </Link>
  )
}

/** Sự kiện — dẫn về dòng tin đã lọc theo đúng sự kiện đó. */
export function EventChip({ event, asLink = true }: { event: string; asLink?: boolean }) {
  const label = EVENT_LABELS[event] || event.replace(/_/g, ' ')
  const content = (
    <span
      className="inline-flex items-center text-[10px] px-2 py-0.5 rounded"
      style={{
        background: 'var(--bg-surface)',
        color: 'var(--text-muted)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {label}
    </span>
  )
  if (!asLink) return content
  return (
    <Link to={`/feed?event=${event}`} onClick={(e) => e.stopPropagation()} title={`Lọc tin có ${label}`}>
      {content}
    </Link>
  )
}

export function SentimentBadge({ sentiment, asLink = true }: { sentiment: string; asLink?: boolean }) {
  const color = SENTIMENT_COLORS[sentiment] || '#64748b'
  const content = (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
      style={{ background: `${color}18`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {SENTIMENT_LABELS[sentiment] || sentiment}
    </span>
  )
  if (!asLink) return content
  return (
    <Link to={`/feed?sentiment=${sentiment}`} onClick={(e) => e.stopPropagation()}>
      {content}
    </Link>
  )
}

/** Kết quả dự đoán.
 *
 * `decision` quan trọng ngang `trend`: "hệ thống cho rằng giá ít biến động" và
 * "hệ thống không đủ chắc chắn để nói gì" là hai chuyện hoàn toàn khác nhau.
 * Nếu giao diện không phân biệt, người dùng sẽ đọc lời từ chối thành một dự đoán.
 *
 * Chữ dùng ở đây tránh mọi thuật ngữ kỹ thuật: người đọc báo tài chính không
 * cần biết "ngưỡng vận hành" hay "ABSTAIN" là gì để hiểu hệ thống đang nói gì.
 */
export function TrendBadge({
  trend,
  confidence,
  decision,
}: {
  trend?: string | null
  confidence?: number | null
  decision?: string | null
}) {
  if (!trend) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(100,116,139,0.12)', color: '#64748b' }}
        title="Mở bài để xem vì sao chưa dự đoán được"
      >
        <Ban size={9} />
        Chưa dự đoán được
      </span>
    )
  }

  const abstained = decision === 'ABSTAIN'
  const color = abstained ? '#64748b' : TREND_COLORS[trend] || '#64748b'
  const Icon = TREND_ICONS[trend as keyof typeof TREND_ICONS] || Minus
  const pct = confidence != null ? Math.round(confidence * 100) : null

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
      style={{ background: `${color}18`, color }}
      title={
        abstained
          ? 'Hệ thống không đủ chắc chắn nên không đưa ra dự đoán cho bài này'
          : `Mức chắc chắn của hệ thống: ${pct}%`
      }
    >
      {abstained ? <Ban size={9} /> : <Icon size={9} />}
      {abstained ? 'Chưa đủ chắc chắn' : TREND_LABELS[trend] || trend}
      {pct != null && !abstained && <span className="tabular-nums opacity-75">{pct}%</span>}
    </span>
  )
}
