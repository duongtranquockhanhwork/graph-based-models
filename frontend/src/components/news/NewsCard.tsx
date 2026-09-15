import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
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
import { contentPreviewParagraphs } from '../../utils/articleContent'
import { useLanguage } from '../../context/LanguageContext'

function KgPath({ path, t }: { path: KgExplanation; t: (key: string, params?: Record<string, string | number>) => string }) {
  const kgKindLabels: Record<string, string> = {
    DIRECT_MENTION: t('newsCard.kgKind.DIRECT_MENTION'),
    COMENTION_HISTORY: t('newsCard.kgKind.COMENTION_HISTORY'),
    INDIRECT_EXPOSURE: t('newsCard.kgKind.INDIRECT_EXPOSURE'),
  }
  return (
    <div className="flex items-start gap-2">
      <Network size={11} className="mt-0.5 flex-shrink-0" style={{ color: '#2563eb' }} />
      <div className="min-w-0">
        <p className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
          {kgKindLabels[path.kind] || path.kind}
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
  const { t } = useLanguage()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const explanation = news.prediction_explanation
  const symbols = (news.stocks_mentioned || []).filter((s) => s !== hideSymbol)
  const kgPaths = explanation?.kg_explanation || []
  const isHeuristic = explanation?.engine === 'heuristic'
  const fallbackTrendLabels: Record<string, string> = {
    INCREASING: t('newsCard.fallbackTrend.INCREASING'),
    DECREASING: t('newsCard.fallbackTrend.DECREASING'),
    UNCHANGED: t('newsCard.fallbackTrend.UNCHANGED'),
  }

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
            <p className="text-[15px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
              {news.title}
            </p>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
              {news.source && <span className="font-medium">{news.source}</span>}
              {news.published_date && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays size={11} /> {news.published_date}
                </span>
              )}
              {!news.is_analyzed && (
                <span className="badge-amber px-2 py-0.5 rounded-full">{t('newsCard.analyzing')}</span>
              )}
              {/* Luôn hiện, không cần mở rộng thẻ trước — đây là thứ người
                  dùng cần tìm ngay, không phải thứ chờ họ tự bấm ra mới thấy. */}
              {news.url && (
                <a
                  href={news.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                  style={{ color: '#2563eb' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={11} /> {t('newsCard.readOriginal')}
                </a>
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
                aria-label={t('newsCard.deleteArticle', { title: news.title })}
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
          {news.content &&
            (() => {
              const preview = contentPreviewParagraphs(news.content)
              return (
                <div className="pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-faint)' }}>
                    {t('newsCard.originalExcerpt')}
                  </p>
                  <div className="space-y-2">
                    {preview.paragraphs.map((para, i) => (
                      <p key={i} className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {para}
                      </p>
                    ))}
                  </div>
                  {preview.truncated && (
                    <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-faint)' }}>
                      {t('newsCard.excerptTruncated')}
                    </p>
                  )}
                </div>
              )
            })()}

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
                      {t('newsCard.systemVerdictAbout')}
                      {explanation.primary_symbol && (
                        <>
                          {' '}{t('newsCard.systemVerdictOn')} <SymbolChip symbol={explanation.primary_symbol} size="sm" />
                        </>
                      )}
                    </p>
                    {explanation.probabilities && (
                      <div className="flex gap-2 text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {Object.entries(explanation.probabilities).map(([k, v]) => (
                          <span key={k}>
                            {k === 'POSITIVE' ? t('newsCard.probPositive') : k === 'NEGATIVE' ? t('newsCard.probNegative') : t('newsCard.probNeutral')}{' '}
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
                        <KgPath key={i} path={p} t={t} />
                      ))}
                    </div>
                  )}

                  {explanation.article_type_caveat && (
                    <details className="mt-2">
                      <summary className="text-[11px] cursor-pointer" style={{ color: 'var(--text-faint)' }}>
                        {t('newsCard.caveatSummary')}
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
                      {t('newsCard.notPredicted')}
                    </p>
                    {/* status UNAVAILABLE luôn cùng một câu chung ("mô hình chưa
                        cấu hình trên máy chủ") cho mọi bài — không đổi theo bài
                        nào nên không có gì đáng nói riêng; chỉ hiện lý do cho
                        REFUSED/ERROR, vốn khác nhau theo từng bài và có ích hơn. */}
                    {explanation.status !== 'UNAVAILABLE' && (
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {explanation.message || explanation.reason || t('newsCard.unknownReason')}
                      </p>
                    )}
                    {explanation.fallback_trend && (
                      <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-faint)' }}>
                        {t('newsCard.fallbackTrendPrefix')}{' '}
                        <strong>{fallbackTrendLabels[explanation.fallback_trend] || explanation.fallback_trend}</strong>
                        {' '}{t('newsCard.fallbackTrendSuffix')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {isHeuristic && (
                <p className="text-[11px] mt-2" style={{ color: '#b45309' }}>
                  {t('newsCard.heuristicNotice')}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            {symbols[0] && (
              <Link
                to={`/graph?stock=${symbols[0]}`}
                className="inline-flex items-center gap-1 hover:underline"
                style={{ color: '#2563eb' }}
                onClick={(e) => e.stopPropagation()}
              >
                <Network size={11} /> {t('newsCard.viewRelated')}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
