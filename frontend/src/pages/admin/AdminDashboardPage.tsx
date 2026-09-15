import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { AlertTriangle, ArrowRight, CheckCircle2, Link2, Newspaper, PenLine, ShieldCheck, XCircle } from 'lucide-react'
import adminApi from '../../services/adminApi'
import type { AdminDashboardStats } from '../../types'
import { StatCard, SectionCard, SkeletonBlock, StatusBadge, CHART_TOOLTIP_STYLE } from '../../components/Admin/AdminWidgets'
import { useLanguage } from '../../context/LanguageContext'

const SENTIMENT_COLORS: Record<string, string> = { Positive: '#10b981', Negative: '#ef4444', Neutral: '#64748b' }
const TREND_COLORS: Record<string, string> = { INCREASING: '#10b981', DECREASING: '#ef4444', UNCHANGED: '#64748b' }

export default function AdminDashboardPage() {
  const { t } = useLanguage()
  const [data, setData] = useState<AdminDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.dashboard().then((r) => setData(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonBlock key={i} />)}
        </div>
        <SkeletonBlock className="h-56" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-400 text-sm">{t('adminDashboard.loadError')}</p>
      </div>
    )
  }

  const { stats, data_quality, trend_distribution, sentiment_distribution, activity, alerts, validation_results, users_summary } = data
  const trendData = Object.entries(trend_distribution).map(([name, value]) => ({ name, value }))
  const sentimentData = Object.entries(sentiment_distribution).map(([name, value]) => ({ name, value }))

  return (
    <div className="p-4 sm:p-6 space-y-5 fade-in">
      <div>
        <p className="text-[11px] uppercase tracking-widest font-semibold mb-2" style={{ color: 'var(--text-faint)' }}>
          {t('adminDashboard.pipelineSectionLabel')}
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <StatCard icon={Newspaper} label={t('adminDashboard.statTotalNewsLabel')} value={stats.total_news} accent="#14b8a6" sub={t('adminDashboard.statTotalNewsSub')} />
          <StatCard icon={Link2} label={t('adminDashboard.statSymbolRowsLabel')} value={stats.news_symbol_rows} accent="#84cc16" sub={t('adminDashboard.statSymbolRowsSub')} />
          <StatCard icon={CheckCircle2} label={t('adminDashboard.statModelReadyLabel')} value={stats.model_ready_rows} accent="#0ea5e9" sub={t('adminDashboard.statModelReadySub')} />
          <StatCard icon={ShieldCheck} label={t('adminDashboard.statPassLabel')} value={stats.pass_count} sub={t('adminDashboard.statPassSub', { pct: stats.pass_pct })} accent="#10b981" />
          <StatCard icon={PenLine} label={t('adminDashboard.statReviewLabel')} value={stats.review_count} accent="#f59e0b" sub={t('adminDashboard.statReviewSub')} />
          <StatCard icon={XCircle} label={t('adminDashboard.statDropLabel')} value={stats.drop_count} accent="#ef4444" sub={t('adminDashboard.statDropSub')} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SectionCard title={t('adminDashboard.dataQualityTitle')} action={<StatusBadge status={data_quality.overall_status} />}>
          <div className="space-y-2.5">
            <QualityRow label={t('adminDashboard.qualityMissingValues')} value={data_quality.missing_values} />
            <QualityRow label={t('adminDashboard.qualityLabelConsistency')} value={`${data_quality.return_label_consistency}%`} />
            <QualityRow label={t('adminDashboard.qualityPassRate')} value={`${data_quality.pass_pct}%`} />
            <QualityRow label={t('adminDashboard.qualityDuplicates')} value={data_quality.duplicates} />
          </div>
        </SectionCard>

        <SectionCard title={t('adminDashboard.predictionDistTitle')}>
          {trendData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={trendData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {trendData.map((e) => <Cell key={e.name} fill={TREND_COLORS[e.name] || '#666'} />)}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <Legend items={trendData} colors={TREND_COLORS} />
        </SectionCard>

        <SectionCard title={t('adminDashboard.sentimentDistTitle')}>
          {sentimentData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={sentimentData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {sentimentData.map((e) => <Cell key={e.name} fill={SENTIMENT_COLORS[e.name] || '#666'} />)}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <Legend items={sentimentData} colors={SENTIMENT_COLORS} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title={t('adminDashboard.activityTitle')}>
          {activity.length === 0 ? (
            <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>{t('adminDashboard.noActivity')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ color: 'var(--text-faint)' }}>
                    <th className="text-left font-medium pb-2">{t('adminDashboard.tableTime')}</th>
                    <th className="text-left font-medium pb-2">{t('adminDashboard.tableActivity')}</th>
                    <th className="text-left font-medium pb-2">{t('adminDashboard.tableActor')}</th>
                    <th className="text-left font-medium pb-2">{t('adminDashboard.tableStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((a) => (
                    <tr key={a.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td className="py-2" style={{ color: 'var(--text-secondary)' }}>{new Date(a.created_at).toLocaleString('vi-VN')}</td>
                      <td className="py-2" style={{ color: 'var(--text-primary)' }}>{a.action}</td>
                      <td className="py-2" style={{ color: 'var(--text-secondary)' }}>{a.actor_name}</td>
                      <td className="py-2"><StatusBadge status={a.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title={t('adminDashboard.alertsTitle')}>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2" style={{ color: '#10b981' }}>
              <CheckCircle2 size={16} />
              <span className="text-[13px]">{t('adminDashboard.noAlerts')}</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {/* Mỗi cảnh báo dẫn thẳng tới nơi khắc phục được nó. Trước đây
                  chúng chỉ là dòng chữ, admin phải tự đoán vào trang nào. */}
              {alerts.map((a, i) => (
                <Link
                  key={i}
                  to={alertTarget(a)}
                  className="flex items-start gap-2 text-[12px] px-2 py-1.5 rounded-lg transition-colors hover:bg-black/5"
                  style={{ color: '#b45309' }}
                >
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <span className="flex-1">{a}</span>
                  <ArrowRight size={12} className="flex-shrink-0 mt-0.5" />
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryLink
          to="/admin/quality"
          title={t('adminDashboard.summaryQualityTitle')}
          detail={t('adminDashboard.summaryQualityDetail', { status: data_quality.overall_status, accuracy: validation_results.accuracy_sentiment ?? '—' })}
        />
        <SummaryLink to="/admin/labeling" title={t('adminDashboard.summaryLabelingTitle')} detail={t('adminDashboard.summaryLabelingDetail', { count: stats.review_count })} />
        <SummaryLink to="/admin/tuning" title={t('adminDashboard.summaryTuningTitle')} detail={t('adminDashboard.summaryTuningDetail')} />
        <SummaryLink to="/admin/users" title={t('adminDashboard.summaryUsersTitle')} detail={t('adminDashboard.summaryUsersDetail', { count: users_summary.total })} />
      </div>
    </div>
  )
}

/** Đưa mỗi cảnh báo về đúng trang xử lý được nó.
 *  Cảnh báo do backend sinh ra (admin/dashboard.py), nên khớp theo nội dung. */
function alertTarget(alert: string): string {
  if (alert.includes('gán nhãn')) return '/admin/labeling'
  if (alert.includes('trùng lặp')) return '/admin/news'
  return '/admin/quality'
}

function QualityRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

function Legend({ items, colors }: { items: { name: string; value: number }[]; colors: Record<string, string> }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
      {items.map(({ name, value }) => (
        <div key={name} className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors[name] || '#666' }} />
          <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {name}: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{value}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function EmptyChart() {
  const { t } = useLanguage()
  return (
    <div className="h-[160px] flex items-center justify-center text-[12px]" style={{ color: 'var(--text-faint)' }}>
      {t('adminDashboard.noChartData')}
    </div>
  )
}

function SummaryLink({ to, title, detail }: { to: string; title: string; detail: string }) {
  const { t } = useLanguage()
  return (
    <Link
      to={to}
      className="section-card card-glow block"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <p className="text-[12px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</p>
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{detail}</p>
      <p className="text-[11px] mt-2" style={{ color: '#059669' }}>{t('adminDashboard.viewDetails')}</p>
    </Link>
  )
}
