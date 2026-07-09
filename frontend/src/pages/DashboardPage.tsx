import { useEffect, useState } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, LineChart, Line, CartesianGrid
} from 'recharts'
import { analyticsApi } from '../services/api'
import type { DashboardStats } from '../types'
import { Newspaper, TrendingUp, Building2, BarChart3 } from 'lucide-react'

const SENTIMENT_COLORS: Record<string, string> = {
  Positive: '#10b981',
  Negative: '#ef4444',
  Neutral: '#475569',
}
const TREND_COLORS: Record<string, string> = {
  INCREASING: '#10b981',
  DECREASING: '#ef4444',
  UNCHANGED: '#475569',
}

const CHART_TOOLTIP_STYLE = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--text-primary)',
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  sub,
}: {
  icon: React.ElementType
  label: string
  value: number
  accent: string
  sub?: string
}) {
  return (
    <div
      className="section-card card-glow flex items-center gap-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: accent + '22', border: `1px solid ${accent}33` }}
      >
        <Icon size={20} style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
        <p className="text-2xl font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{value.toLocaleString()}</p>
        {sub && <p className="text-[11px] mt-1" style={{ color: 'var(--text-faint)' }}>{sub}</p>}
      </div>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-5 card-glow"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <h3 className="font-semibold text-[13px] mb-4" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      {children}
    </div>
  )
}

function SkeletonCard() {
  return <div className="skeleton h-20 rounded-2xl" />
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    analyticsApi.dashboard().then(r => setStats(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6 space-y-5">
        <div className="skeleton h-7 w-48 rounded-lg" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-56 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-400 text-sm">Không thể tải dữ liệu dashboard</p>
      </div>
    )
  }

  const sentimentData = Object.entries(stats.sentiment_distribution).map(([name, value]) => ({ name, value }))
  const trendData = Object.entries(stats.trend_distribution).map(([name, value]) => ({ name, value }))
  const analyzedPct = stats.total_news > 0 ? Math.round((stats.analyzed_news / stats.total_news) * 100) : 0

  return (
    <div className="p-6 space-y-5 fade-in">
      {/* Stats row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={Newspaper}
          label="Tổng bài báo"
          value={stats.total_news}
          accent="#3b82f6"
          sub="Tổng số tin đã nhập"
        />
        <StatCard
          icon={BarChart3}
          label="Đã phân tích"
          value={stats.analyzed_news}
          accent="#10b981"
          sub={`${analyzedPct}% tổng số tin`}
        />
        <StatCard
          icon={TrendingUp}
          label="Mã cổ phiếu"
          value={stats.total_stocks}
          accent="#8b5cf6"
          sub="Được nhận diện trong tin"
        />
        <StatCard
          icon={Building2}
          label="Công ty"
          value={stats.total_companies}
          accent="#f59e0b"
          sub="Xuất hiện trong KG"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SectionCard title="Phân bố Sentiment">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={sentimentData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={3}
                dataKey="value"
              >
                {sentimentData.map(entry => (
                  <Cell key={entry.name} fill={SENTIMENT_COLORS[entry.name] || '#666'} />
                ))}
              </Pie>
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
            {sentimentData.map(({ name, value }) => (
              <div key={name} className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: SENTIMENT_COLORS[name] || '#666' }}
                />
                <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  {name}: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{value}</span>
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Xu hướng dự đoán">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={trendData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) =>
                  percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                }
                labelLine={false}
              >
                {trendData.map(entry => (
                  <Cell key={entry.name} fill={TREND_COLORS[entry.name] || '#666'} />
                ))}
              </Pie>
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
            {trendData.map(({ name, value }) => (
              <div key={name} className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: TREND_COLORS[name] || '#666' }}
                />
                <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  {name === 'INCREASING' ? '↑ Tăng' : name === 'DECREASING' ? '↓ Giảm' : '— Ổn định'}:{' '}
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{value}</span>
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Top ngành nghề">
          <div className="space-y-3 mt-1">
            {stats.top_industries.slice(0, 6).map((item, idx) => {
              const max = stats.top_industries[0]?.count || 1
              const pct = (item.count / max) * 100
              return (
                <div key={item.industry}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[12px] truncate pr-2" style={{ color: 'var(--text-secondary)' }}>
                      {idx + 1}. {item.industry}
                    </span>
                    <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: '#60a5fa' }}>
                      {item.count}
                    </span>
                  </div>
                  <div className="conf-bar">
                    <div
                      className="conf-bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, #2563eb, #0ea5e9)`,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Top cổ phiếu được nhắc đến">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={stats.top_stocks} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2d4a" vertical={false} />
              <XAxis
                dataKey="symbol"
                stroke="transparent"
                tick={{ fill: '#64748b', fontSize: 11 }}
              />
              <YAxis stroke="transparent" tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                cursor={{ fill: 'rgba(37,99,235,0.06)' }}
              />
              <Bar dataKey="count" name="Lần nhắc" radius={[5, 5, 0, 0]}>
                {stats.top_stocks.map((_, i) => (
                  <Cell
                    key={i}
                    fill={i === 0 ? '#2563eb' : i === 1 ? '#3b82f6' : '#1e3a6e'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Tin tức theo ngày">
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={stats.news_by_date}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2d4a" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="transparent"
                tick={{ fill: '#64748b', fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis stroke="transparent" tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ stroke: '#2563eb', strokeWidth: 1 }} />
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>
              <Line
                type="monotone"
                dataKey="count"
                name="Số tin"
                stroke="url(#lineGrad)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>
    </div>
  )
}
