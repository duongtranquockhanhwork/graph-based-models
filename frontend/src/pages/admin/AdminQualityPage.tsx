import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, PenLine, RefreshCw, Sliders, XCircle } from 'lucide-react'
import adminApi from '../../services/adminApi'
import { SkeletonBlock } from '../../components/Admin/AdminWidgets'
import { useLanguage } from '../../context/LanguageContext'

interface DataValidation {
  total_news: number
  news_symbol_rows: number
  model_ready_rows: number
  total_processed: number
  pass_count: number
  pass_pct: number
  review_count: number
  drop_count: number
  missing_values: number
  duplicates: number
  return_label_consistency: number
  checks: Record<string, boolean>
  failed_checks: string[]
  split_leakage_note: string
  overall_status: 'PASS' | 'FAIL'
}

interface LabelAgreement {
  total_labeled: number
  sentiment_labeled_count: number
  accuracy_sentiment: number | null
  event_labeled_count: number
  accuracy_event: number | null
  selection_bias_note?: string
}

function Card({
  title,
  desc,
  action,
  children,
}: {
  title: string
  desc?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="section-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h3>
          {desc && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {desc}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <span className="text-[13px] font-semibold tabular-nums" style={{ color: accent || 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  )
}

/** Chất lượng dữ liệu và nhãn — gộp hai trang cũ.
 *
 * `/admin/data-validation` và `/admin/validation-results` là hai trang riêng
 * nhưng cùng đọc `validation_service`, cùng trả lời một câu hỏi ("dữ liệu và
 * nhãn có dùng được không"), và cả hai đều không dẫn tới nơi khắc phục.
 *
 * Trang này gộp chúng và nối vào hai nơi thực sự thay đổi được kết quả: hàng
 * chờ Gán nhãn (thêm nhãn) và Cấu hình phân tích (đổi ngưỡng).
 */
export default function AdminQualityPage() {
  const { t } = useLanguage()
  const [validation, setValidation] = useState<DataValidation | null>(null)
  const [agreement, setAgreement] = useState<LabelAgreement | null>(null)
  const [loading, setLoading] = useState(true)

  const CHECK_LABELS: Record<string, string> = {
    no_missing_values: t('adminQuality.checkLabels.noMissingValues'),
    no_duplicates: t('adminQuality.checkLabels.noDuplicates'),
    label_consistency_ok: t('adminQuality.checkLabels.labelConsistencyOk'),
    enough_usable_rows: t('adminQuality.checkLabels.enoughUsableRows'),
  }

  const FAILURE_LABELS: Record<string, string> = {
    no_missing_values: t('adminQuality.failureLabels.noMissingValues'),
    no_duplicates: t('adminQuality.failureLabels.noDuplicates'),
    label_consistency_ok: t('adminQuality.failureLabels.labelConsistencyOk'),
    enough_usable_rows: t('adminQuality.failureLabels.enoughUsableRows'),
  }

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      adminApi.validation.dataQuality().then((r) => setValidation(r.data)),
      adminApi.validation.results().then((r) => setAgreement(r.data)),
    ]).finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  return (
    <div className="p-4 sm:p-6 space-y-4 fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('adminQuality.title')}
          </h2>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {t('adminQuality.subtitle')}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px]"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> {t('adminQuality.rerun')}
        </button>
      </div>

      {loading || !validation ? (
        <SkeletonBlock className="h-72" />
      ) : (
        <>
          {/* Kết luận tổng thể, kèm việc cần làm */}
          <div
            className="rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3"
            style={{
              background: validation.overall_status === 'PASS' ? 'rgba(16,185,129,0.08)' : 'rgba(217,119,6,0.08)',
              border: `1px solid ${validation.overall_status === 'PASS' ? 'rgba(16,185,129,0.25)' : 'rgba(217,119,6,0.28)'}`,
            }}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {validation.overall_status === 'PASS' ? (
                <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" style={{ color: '#0b7d5a' }} />
              ) : (
                <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" style={{ color: '#b45309' }} />
              )}
              <div>
                <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {validation.overall_status === 'PASS'
                    ? t('adminQuality.allChecksPass')
                    : t('adminQuality.failedChecksCount', { count: validation.failed_checks.length })}
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {validation.overall_status === 'PASS'
                    ? t('adminQuality.allChecksPassDesc')
                    : t('adminQuality.issuesDesc', {
                        issues: validation.failed_checks.map((c) => FAILURE_LABELS[c] || c).join(' · '),
                      })}
                </p>
              </div>
            </div>
            {validation.review_count > 0 && (
              <Link
                to="/admin/labeling"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #047857, #10b981)' }}
              >
                <PenLine size={12} /> {t('adminQuality.processQueueCta', { count: validation.review_count })}
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card
              title={t('adminQuality.pipelineTitle')}
              desc={t('adminQuality.pipelineDesc')}
            >
              <div className="space-y-2.5">
                <Row label={t('adminQuality.totalNews')} value={validation.total_news} />
                <Row label={t('adminQuality.processed')} value={validation.total_processed} />
                <Row
                  label={t('adminQuality.usable')}
                  value={`${validation.pass_count} (${validation.pass_pct}%)`}
                  accent={validation.pass_pct >= 50 ? '#0b7d5a' : '#c0392e'}
                />
                <Row label={t('adminQuality.pendingManualReview')} value={validation.review_count} accent="#b45309" />
                <Row
                  label={t('adminQuality.skipped')}
                  value={validation.drop_count}
                  accent={validation.drop_count > 0 ? '#c0392e' : undefined}
                />
                <Row label={t('adminQuality.newsSymbolRows')} value={validation.news_symbol_rows} />
              </div>

              {validation.drop_count > 0 && (
                <p className="text-[11px] mt-3 pt-3" style={{ color: 'var(--text-faint)', borderTop: '1px dashed var(--border-subtle)' }}>
                  {t('adminQuality.skippedNotePrefix')}{' '}
                  <Link to="/admin/tuning" className="hover:underline" style={{ color: '#2563eb' }}>
                    {t('adminQuality.tuningLink')}
                  </Link>
                  .
                </p>
              )}
            </Card>

            <Card
              title={t('adminQuality.checksTitle')}
              desc={t('adminQuality.checksDesc')}
            >
              <div className="space-y-2.5 mb-4">
                <Row label={t('adminQuality.missingRecords')} value={validation.missing_values} />
                <Row label={t('adminQuality.duplicateRecords')} value={validation.duplicates} />
                <Row label={t('adminQuality.labelConsistencyPct')} value={`${validation.return_label_consistency}%`} />
              </div>

              <div className="space-y-1.5 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                {Object.entries(validation.checks).map(([key, ok]) => (
                  <div key={key} className="flex items-center gap-2">
                    {ok ? (
                      <CheckCircle2 size={12} className="flex-shrink-0" style={{ color: '#0b7d5a' }} />
                    ) : (
                      <XCircle size={12} className="flex-shrink-0" style={{ color: '#c0392e' }} />
                    )}
                    <span className="text-[11px]" style={{ color: ok ? 'var(--text-muted)' : '#c0392e' }}>
                      {CHECK_LABELS[key] || key}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-[11px] mt-3 pt-3" style={{ color: 'var(--text-faint)', borderTop: '1px dashed var(--border-subtle)' }}>
                {validation.split_leakage_note}
              </p>
            </Card>
          </div>

          {/* Độ khớp nhãn — nội dung của trang "Kết quả kiểm định" cũ */}
          <Card
            title={t('adminQuality.agreementTitle')}
            desc={t('adminQuality.agreementDesc')}
            action={
              <Link
                to="/admin/labeling"
                className="inline-flex items-center gap-1.5 text-[12px] hover:underline"
                style={{ color: '#2563eb' }}
              >
                <PenLine size={12} /> {t('adminQuality.openQueue')}
              </Link>
            }
          >
            {!agreement || agreement.total_labeled === 0 ? (
              <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                {t('adminQuality.noLabeledPrefix')}{' '}
                <Link to="/admin/labeling" className="hover:underline" style={{ color: '#2563eb' }}>
                  {t('adminQuality.labelingLink')}
                </Link>{' '}
                {t('adminQuality.noLabeledSuffix')}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      label: t('adminQuality.sentimentAgreement'),
                      value: agreement.accuracy_sentiment != null ? `${agreement.accuracy_sentiment}%` : '—',
                      sub: t('adminQuality.samplesCount', { count: agreement.sentiment_labeled_count }),
                      color: '#0b7d5a',
                    },
                    {
                      label: t('adminQuality.eventAgreement'),
                      value: agreement.accuracy_event != null ? `${agreement.accuracy_event}%` : '—',
                      sub: t('adminQuality.samplesCount', { count: agreement.event_labeled_count }),
                      color: '#2563eb',
                    },
                    {
                      label: t('adminQuality.confirmedCount'),
                      value: String(agreement.total_labeled),
                      sub: t('adminQuality.adminReviewed'),
                      color: '#b45309',
                    },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="rounded-xl p-3.5"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                    >
                      <p className="text-2xl font-bold tabular-nums" style={{ color: m.color }}>
                        {m.value}
                      </p>
                      <p className="text-[12px] font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                        {m.label}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                        {m.sub}
                      </p>
                    </div>
                  ))}
                </div>

                <div
                  className="mt-3 rounded-xl p-3 flex items-start gap-2"
                  style={{ background: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.2)' }}
                >
                  <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#b45309' }} />
                  <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {agreement.selection_bias_note || t('adminQuality.selectionBiasDefault')}{' '}
                    {t('adminQuality.notAccuracyPrefix')} <strong>{t('adminQuality.notAccuracyStrong')}</strong>{' '}
                    {t('adminQuality.notAccuracySuffix')}
                  </p>
                </div>
              </>
            )}
          </Card>

          <div
            className="rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3"
            style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-subtle)' }}
          >
            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
              {t('adminQuality.improveCta')}
            </p>
            <div className="flex gap-2">
              <Link
                to="/admin/labeling"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px]"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                <PenLine size={12} /> {t('adminQuality.labelingBtn')}
              </Link>
              <Link
                to="/admin/tuning"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px]"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                <Sliders size={12} /> {t('adminQuality.tuningBtn')}
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
