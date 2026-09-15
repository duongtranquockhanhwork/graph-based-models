import { Activity, Compass, ShieldAlert } from 'lucide-react'
import { useModelInfo } from '../../hooks/useModelInfo'
import type { RecommendationEvidence } from '../../types'
import { useLanguage } from '../../context/LanguageContext'

const BAND_STYLE = {
  LOW: { background: 'rgba(100,116,139,0.12)', color: 'var(--text-muted)' },
  MEDIUM: { background: 'rgba(37,99,235,0.12)', color: '#2563eb' },
  HIGH: { background: 'rgba(245,158,11,0.15)', color: '#b45309' },
} as const

function pct(value: number, digits = 0): string {
  return `${(value * 100).toLocaleString('vi-VN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`
}

/** Đọc một nhận định theo ba câu người dùng thật sự hỏi — giá có biến động
 *  mạnh không, theo chiều nào, có nên mua bán không — và trả lời mỗi câu đúng
 *  bằng mức mà số đo cho phép.
 *
 *  Panel không tự tuyên bố điều gì. Mọi con số đến từ `recommendation_evidence`,
 *  do backend/tools/measure_recommendation_evidence.py sinh ra bằng cách chấm
 *  chính mô hình đang chạy trên bài 2026 nó chưa từng thấy. Chưa có số đo thì
 *  panel không hiện.
 *
 *  Vì sao KHÔNG có dòng "lợi nhuận kỳ vọng": đã đo, và những bài được dự báo có
 *  lời thực tế lỗ sau phí, khoảng tin cậy nằm hoàn toàn dưới 0. Một con số dương
 *  ở đây sẽ khiến người dùng lỗ đúng lúc họ tin hệ thống nhất.
 */
export default function RecommendationPanel({ probabilities }: { probabilities: Record<string, number> }) {
  const info = useModelInfo()
  const evidence = info?.recommendation_evidence
  if (!evidence) return null
  return <Panel probabilities={probabilities} evidence={evidence} />
}

function Panel({
  probabilities,
  evidence,
}: {
  probabilities: Record<string, number>
  evidence: RecommendationEvidence
}) {
  const { t } = useLanguage()
  const BAND_LABEL = {
    LOW: t('recommendationPanel.bandLabel.LOW'),
    MEDIUM: t('recommendationPanel.bandLabel.MEDIUM'),
    HIGH: t('recommendationPanel.bandLabel.HIGH'),
  } as const
  const up = probabilities.POSITIVE ?? 0
  const down = probabilities.NEGATIVE ?? 0
  const flat = probabilities.NEUTRAL ?? 0

  // "Biến động mạnh" là mọi thứ không phải NEUTRAL — đây là phần mô hình làm
  // tốt: xếp hạng đúng, dù mức tuyệt đối bị thổi cao, nên hiện theo MỨC kèm tỉ
  // lệ thực tế đã đo, không hiện xác suất thô.
  const pLarge = 1 - flat
  const [lowEdge, highEdge] = evidence.magnitude.band_edges
  const band = pLarge < lowEdge ? 'LOW' : pLarge < highEdge ? 'MEDIUM' : 'HIGH'
  const bandInfo = evidence.magnitude.bands.find((b) => b.band === band)

  const leansUp = up >= down
  const lean = up + down > 0 ? Math.max(up, down) / (up + down) : 0.5

  const { direction, expected_return: expected } = evidence
  const cost = evidence.round_trip_cost
  const threshold = evidence.large_move_threshold
  const followed = expected.predicted_positive.realised_net_mean
  // Gần 50% nghĩa là đoán chiều không hơn tung đồng xu. Nói thẳng như vậy cho
  // người đọc không quen số liệu — nhưng rút từ số đo, không viết cứng.
  const coinFlip = Math.abs(direction.hit_rate - 0.5) < 0.03

  const reasons: string[] = []
  if (expected.verdict !== 'PREDICTIVE_ON_2026') {
    reasons.push(
      t('recommendationPanel.neverProfitable', {
        direction: followed < 0 ? t('recommendationPanel.lossWord') : t('recommendationPanel.profitWord'),
        pct: pct(Math.abs(followed), 2),
      }),
    )
  }
  if (direction.verdict === 'BELOW_BREAK_EVEN') {
    reasons.push(
      t('recommendationPanel.belowBreakEven', {
        hitRate: pct(direction.hit_rate, 1),
        breakEven: pct(direction.break_even_hit_rate, 1),
      }),
    )
  }

  return (
    <section
      aria-label={t('recommendationPanel.ariaLabel')}
      className="rounded-xl p-3 mt-2 space-y-2.5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
        {t('recommendationPanel.heading')}
      </p>

      {/* 1. Độ lớn — phần mô hình làm được */}
      <div className="flex items-start gap-2">
        <Activity size={13} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
        <div className="min-w-0">
          <p className="text-[12px]" style={{ color: 'var(--text-primary)' }}>
            {t('recommendationPanel.expectedMagnitude')}{' '}
            <span className="px-1.5 py-0.5 rounded-md text-[11px] font-semibold" style={BAND_STYLE[band]}>
              {BAND_LABEL[band]}
            </span>
          </p>
          {bandInfo?.realised_large_move_share != null && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {t('recommendationPanel.realisedShare', {
                threshold: pct(threshold),
                share: pct(bandInfo.realised_large_move_share),
                baseRate: pct(evidence.magnitude.base_rate),
              })}
            </p>
          )}
        </div>
      </div>

      {/* 2. Chiều — phần mô hình chưa làm được */}
      <div className="flex items-start gap-2">
        <Compass size={13} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
        <div className="min-w-0">
          <p className="text-[12px]" style={{ color: 'var(--text-primary)' }}>
            {t('recommendationPanel.leansTowards')} <strong>{leansUp ? t('recommendationPanel.up') : t('recommendationPanel.down')}</strong>{' '}
            <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {t('recommendationPanel.comparedTo', { lean: pct(lean), other: pct(1 - lean) })}
            </span>
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {t('recommendationPanel.directionAccuracy', {
              hitRate: pct(direction.hit_rate, 1),
              coinFlip: coinFlip ? t('recommendationPanel.coinFlipNote') : '',
              breakEven: pct(direction.break_even_hit_rate, 1),
              cost: pct(cost, 1),
            })}
          </p>
        </div>
      </div>

      {/* 3. Kết luận */}
      <div className="flex items-start gap-2 pt-2" style={{ borderTop: '1px dashed var(--border-subtle)' }}>
        <ShieldAlert size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#b45309' }} />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('recommendationPanel.notRecommended')}
          </p>
          {reasons.length > 0 && (
            <ul className="text-[11px] mt-1 space-y-0.5 list-disc pl-4" style={{ color: 'var(--text-muted)' }}>
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          {band === 'HIGH' && (
            <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-secondary)' }}>
              {t('recommendationPanel.highBandNote')}
            </p>
          )}
        </div>
      </div>

      <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
        {t('recommendationPanel.footerNote', {
          articles: evidence.data.articles.toLocaleString('vi-VN'),
          start: evidence.data.date_range[0],
          end: evidence.data.date_range[1],
        })}
      </p>
    </section>
  )
}
