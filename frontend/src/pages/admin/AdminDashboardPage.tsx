import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Newspaper, Link2, CheckCircle2, ShieldCheck, PenLine, XCircle, AlertTriangle } from 'lucide-react'
import adminApi from '../../services/adminApi'
import type { AdminDashboardStats } from '../../types'
import { StatCard, SectionCard, SkeletonBlock, StatusBadge, CHART_TOOLTIP_STYLE } from '../../components/Admin/AdminWidgets'

const SENTIMENT_COLORS: Record<string, string> = { Positive: '#10b981', Negative: '#ef4444', Neutral: '#64748b' }
const TREND_COLORS: Record<string, string> = { INCREASING: '#10b981', DECREASING: '#ef4444', UNCHANGED: '#64748b' }

export default function AdminDashboardPage() {
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
        <p className="text-red-400 text-sm">Không thể tải dữ liệu dashboard admin</p>
      </div>
    )
  }

  const { stats, data_quality, trend_distribution, sentiment_distribution, activity, alerts, validation_results, users_summary } = data
  const trendData = Object.entries(trend_distribution).map(([name, value]) => ({ name, value }))
  const sentimentData = Object.entries(sentiment_distribution).map(([name, value]) => ({ name, value }))

  return (
    <div className="p-6 space-y-5 fade-in">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={Newspaper} label="Tổng số tin" value={stats.total_news} accent="#14b8a6" />
        <StatCard icon={Link2} label="Dòng dữ liệu" value={stats.news_symbol_rows} accent="#84cc16" sub="news-symbol" />
        <StatCard icon={CheckCircle2} label="Dòng model-ready" value={stats.model_ready_rows} accent="#0ea5e9" />
        <StatCard icon={ShieldCheck} label="Dòng PASS" value={`${stats.pass_count} (${stats.pass_pct}%)`} accent="#10b981" />
        <StatCard icon={PenLine} label="Dòng REVIEW" value={stats.review_count} accent="#f59e0b" />
        <StatCard icon={XCircle} label="Dòng DROP" value={stats.drop_count} accent="#ef4444" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SectionCard title="Chất lượng dữ liệu" action={<StatusBadge status={data_quality.overall_status} />}>
          <div className="space-y-2.5">
            <QualityRow label="Missing values (các cột quan trọng)" value={data_quality.missing_values} />
            <QualityRow label="Return-Label Consistency" value={`${data_quality.return_label_consistency}%`} />
            <QualityRow label="News_id leakage giữa các split" value={data_quality.split_leakage} />
            <QualityRow label="Trùng lặp (title + mã cổ phiếu)" value={data_quality.duplicates} />
          </div>
        </SectionCard>

        <SectionCard title="Phân bố nhãn xu hướng">
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

        <SectionCard title="Phân bố cảm xúc">
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
        <SectionCard title="Hoạt động hệ thống">
          {activity.length === 0 ? (
            <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>Chưa có hoạt động nào</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ color: 'var(--text-faint)' }}>
                    <th className="text-left font-medium pb-2">Thời gian</th>
                    <th className="text-left font-medium pb-2">Hoạt động</th>
                    <th className="text-left font-medium pb-2">Người thực hiện</th>
                    <th className="text-left font-medium pb-2">Trạng thái</th>
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

        <SectionCard title="Cảnh báo hệ thống">
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2" style={{ color: '#10b981' }}>
              <CheckCircle2 size={16} />
              <span className="text-[13px]">Không có cảnh báo</span>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-[12px]" style={{ color: '#b45309' }}>
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{a}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryLink to="/admin/data-validation" title="Kiểm định dữ liệu" detail={data_quality.overall_status} />
        <SummaryLink to="/admin/labeling" title="Gán nhãn thủ công" detail={`${stats.review_count} mẫu chờ gán nhãn`} />
        <SummaryLink
          to="/admin/validation-results"
          title="Kết quả kiểm định"
          detail={`Sentiment ${validation_results.accuracy_sentiment ?? '—'}% · Event ${validation_results.accuracy_event ?? '—'}%`}
        />
        <SummaryLink to="/admin/users" title="Quản lý người dùng" detail={`${users_summary.total} tài khoản`} />
      </div>
    </div>
  )
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
  return (
    <div className="h-[160px] flex items-center justify-center text-[12px]" style={{ color: 'var(--text-faint)' }}>
      Chưa có dữ liệu
    </div>
  )
}

function SummaryLink({ to, title, detail }: { to: string; title: string; detail: string }) {
  return (
    <Link
      to={to}
      className="section-card card-glow block"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <p className="text-[12px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</p>
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{detail}</p>
      <p className="text-[11px] mt-2" style={{ color: '#059669' }}>Xem chi tiết →</p>
    </Link>
  )
}
