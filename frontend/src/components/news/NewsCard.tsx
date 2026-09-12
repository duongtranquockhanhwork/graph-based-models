import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Info,
  Network,
  Trash2,
} from 'lucide-react'
import type { KgExplanation, NewsArticle } from '../../types'

import { EventChip, SentimentBadge, SymbolChip, TrendBadge } from '../common/Chips'
import RecommendationPanel from './RecommendationPanel'
import EntryLadderPanel from './EntryLadderPanel'
import AiAnalysisSection from './AiAnalysisSection'

/** Nhãn cho suy đoán dự phòng. Giá trị gốc là INCREASING/DECREASING/UNCHANGED —
 *  chuỗi kỹ thuật không nên lọt ra giao diện. */
const FALLBACK_TREND_LABELS: Record<string, string> = {
  INCREASING: 'giá tăng',
  DECREASING: 'giá giảm',
  UNCHANGED: 'giá ít đổi',
}


const KG_KIND_LABELS: Record<string, string> = {
  DIRECT_MENTION: 'Được nhắc thẳng trong bài',
  COMENTION_HISTORY: 'Hay xuất hiện cùng nhau trong tin trước đây',
  INDIRECT_EXPOSURE: 'Cùng ngành nên có thể bị ảnh hưởng theo',
}

function KgPath({ path }: { path: KgExplanation }) {
  return (
    <div className="flex items-start gap-2">
      <Network size={11} className="mt-0.5 flex-shrink-0" style={{ color: '#2563eb' }} />
      <div className="min-w-0">
        <p className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
          {KG_KIND_LABELS[path.kind] || path.kind}
        </p>
        {path.detail && (
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {path.detail}
          </p>
        )}
        {path.peers && path.peers.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {path.peers.map((p) => (
              <SymbolChip key={p} symbol={p} size="sm" muted />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export interface NewsCardProps {
  news: NewsArticle
  onDelete?: () => void
  /** Ẩn mã này khỏi danh sách chip — dùng khi thẻ đang hiển thị trong hồ sơ
   *  của chính mã đó, nhắc lại là thừa. */
  hideSymbol?: string
  defaultExpanded?: boolean
}

/** Một bài báo, hiển thị giống hệt nhau ở mọi nơi trong ứng dụng.
 *
 * Trước đây mỗi trang tự vẽ thẻ tin theo cách riêng, nên cùng một bài trông
 * khác nhau ở Tin tức, Sự kiện và Cảm xúc — và chỉ một trong ba nơi cho bấm
 * vào mã cổ phiếu.
 */
export default function NewsCard({ news, onDelete, hideSymbol, defaultExpanded = false }: NewsCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const explanation = news.prediction_explanation
  const symbols = (news.stocks_mentioned || []).filter((s) => s !== hideSymbol)
  const kgPaths = explanation?.kg_explanation || []
  const isHeuristic = explanation?.engine === 'heuristic'

  return (
    <div
      className="rounded-2xl overflow-hidden transition-colors"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded((v) => !v)
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
              {news.title}
            </p>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5 text-[11px]" style={{ color: 'var(--text-faint)' }}>
              {news.source && <span>{news.source}</span>}
              {news.published_date && <span>{news.published_date}</span>}
              {!news.is_analyzed && (
                <span className="badge-amber px-2 py-0.5 rounded-full">Đang phân tích…</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              {news.sentiment && <SentimentBadge sentiment={news.sentiment} />}
              {news.is_analyzed && (
                <TrendBadge
                  trend={news.predicted_trend}
                  confidence={news.prediction_confidence}
                  decision={news.prediction_decision}
                />
              )}
              {symbols.slice(0, 5).map((s) => (
                <SymbolChip key={s} symbol={s} />
              ))}
              {symbols.length > 5 && (
                <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                  +{symbols.length - 5}
                </span>
              )}
              {(news.events_detected || []).slice(0, 3).map((e) => (
                <EventChip key={e} event={e} />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                aria-label={`Xoá bài báo: ${news.title}`}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--text-faint)' }}
              >
                <Trash2 size={13} />
              </button>
            )}
            <span style={{ color: 'var(--text-faint)' }}>
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {news.content && (
            <p className="text-[12px] leading-relaxed pt-3" style={{ color: 'var(--text-secondary)' }}>
              {news.content.slice(0, 600)}
              {news.content.length > 600 && '…'}
            </p>
          )}

          {/* Claude đọc bài và giải thích bằng lời thường — đặt trước phần số liệu
              của hệ thống, vì đó là thứ người đọc cần hiểu trước. */}
          {news.is_analyzed && <AiAnalysisSection newsId={news.id} initial={news.ai_analysis} />}

          {/* Vì sao mô hình kết luận như vậy — hoặc vì sao nó không trả lời. */}
          {explanation && (
            <div
              className="rounded-xl p-3"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              {explanation.status === 'SCORED' ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Hệ thống nhận định
                      {explanation.primary_symbol && (
                        <>
                          {' '}về <SymbolChip symbol={explanation.primary_symbol} size="sm" />
                        </>
                      )}
                    </p>
                    {explanation.probabilities && (
                      <div className="flex gap-2 text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {Object.entries(explanation.probabilities).map(([k, v]) => (
                          <span key={k}>
                            {k === 'POSITIVE' ? 'Tăng' : k === 'NEGATIVE' ? 'Giảm' : 'Ít đổi'}{' '}
                            {(v * 100).toFixed(0)}%
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {explanation.human_explanation && (
                    <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>
                      {explanation.human_explanation}
                    </p>
                  )}

                  {/* Chỉ cho kết quả của mô hình đã kiểm chứng: bộ luật dự phòng
                      không có xác suất, và số đo trong panel không mô tả nó. */}
                  {explanation.engine === 'finnexus' && explanation.probabilities && (
                    <>
                      <RecommendationPanel probabilities={explanation.probabilities} />
                      <EntryLadderPanel
                        probabilities={explanation.probabilities}
                        volatility={explanation.volatility_20d ?? null}
                        referenceClose={explanation.reference_close ?? null}
                        referenceSession={explanation.reference_session ?? null}
                      />
                    </>
                  )}

                  {kgPaths.length > 0 && (
                    <div className="space-y-1.5 pt-2" style={{ borderTop: '1px dashed var(--border-subtle)' }}>
                      {kgPaths.map((p, i) => (
                        <KgPath key={i} path={p} />
                      ))}
                    </div>
                  )}

                  {explanation.article_type_caveat && (
                    <details className="mt-2">
                      <summary className="text-[11px] cursor-pointer" style={{ color: 'var(--text-faint)' }}>
                        Nhận định này đáng tin đến đâu với loại bài này?
                      </summary>
                      <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                        {explanation.article_type_caveat}
                      </p>
                    </details>
                  )}
                </>
              ) : (
                <div className="flex items-start gap-2">
                  <Info size={12} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
                  <div>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>
                      Không dự đoán được bài này
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {explanation.message || explanation.reason || 'Chưa rõ nguyên nhân.'}
                    </p>
                    {explanation.fallback_trend && (
                      <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-faint)' }}>
                        Nếu chỉ nhìn vào từ ngữ trong bài thì thiên về{' '}
                        <strong>{FALLBACK_TREND_LABELS[explanation.fallback_trend] || explanation.fallback_trend}</strong>
                        {' '}— đây chỉ là suy đoán từ câu chữ, chưa đối chiếu với diễn biến giá.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {isHeuristic && (
                <p className="text-[11px] mt-2" style={{ color: '#b45309' }}>
                  Nhận định này chỉ dựa trên từ ngữ trong bài, chưa được đối chiếu với diễn biến
                  giá thực tế — hãy đọc như một gợi ý, không phải kết luận.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            {news.url && (
              <a
                href={news.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
                style={{ color: '#2563eb' }}
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={11} /> Đọc bài gốc
              </a>
            )}
            {symbols[0] && (
              <Link
                to={`/graph?stock=${symbols[0]}`}
                className="inline-flex items-center gap-1 hover:underline"
                style={{ color: '#2563eb' }}
                onClick={(e) => e.stopPropagation()}
              >
                <Network size={11} /> Xem mã này liên quan tới gì
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
