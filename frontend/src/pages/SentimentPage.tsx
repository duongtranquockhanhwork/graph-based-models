import { useEffect, useMemo, useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import { analyticsApi, newsApi } from '../services/api'
import type { DashboardStats, NewsArticle, StockAggregation } from '../types'

const SENTIMENT_COLORS: Record<string, string> = {
  Positive: '#10b981',
  Negative: '#ef4444',
  Neutral: '#64748b',
}

const CHART_TOOLTIP_STYLE = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--text-primary)',
}

export default function SentimentPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [stocks, setStocks] = useState<StockAggregation[]>([])
  const [news, setNews] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      analyticsApi.dashboard().then((r) => setStats(r.data)),
      analyticsApi.stocks().then((r) => setStocks(r.data)),
      newsApi.list({ skip: 0, limit: 300 }).then((r) => setNews(r.data)),
    ]).finally(() => setLoading(false))
  }, [])

  const sentimentData = stats ? Object.entries(stats.sentiment_distribution).map(([name, value]) => ({ name, value })) : []

  const topStocksBySentiment = useMemo(() => {
    return stocks
      .filter((s) => Object.values(s.sentiment_distribution).reduce((a, b) => a + b, 0) > 0)
      .map((s) => {
        const total = Object.values(s.sentiment_distribution).reduce((a, b) => a + b, 0)
        return {
          symbol: s.symbol,
          Positive: s.sentiment_distribution.Positive || 0,
          Neutral: s.sentiment_distribution.Neutral || 0,
          Negative: s.sentiment_distribution.Negative || 0,
          total,
        }
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
  }, [stocks])

  const byDate = useMemo(() => {
    const map = new Map<string, { date: string; Positive: number; Neutral: number; Negative: number }>()
    for (const n of news) {
      if (!n.published_date || !n.sentiment) continue
      const date = n.published_date.slice(0, 10)
      if (!map.has(date)) map.set(date, { date, Positive: 0, Neutral: 0, Negative: 0 })
      const row = map.get(date)!
      if (n.sentiment === 'Positive' || n.sentiment === 'Negative' || n.sentiment === 'Neutral') {
        row[n.sentiment] += 1
      }
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)).slice(-30)
  }, [news])

  if (loading) {
    return (
      <div className="p-6 space-y-5">
        <div className="skeleton h-7 w-52 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-64 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 fade-in">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Phân tích cảm xúc</h2>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Tổng hợp Sentiment theo toàn thị trường, theo cổ phiếu và theo thời gian
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="section-card">
          <h3 className="text-[13px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Phân bố tổng thể</h3>
          {sentimentData.length === 0 ? (
            <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>Chưa có dữ liệu</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={sentimentData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {sentimentData.map((e) => <Cell key={e.name} fill={SENTIMENT_COLORS[e.name] || '#666'} />)}
                  </Pie>
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 justify-center">
                {sentimentData.map(({ name, value }) => (
                  <div key={name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: SENTIMENT_COLORS[name] || '#666' }} />
                    <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      {name}: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{value}</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="section-card">
          <h3 className="text-[13px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Sentiment theo cổ phiếu (top 8)</h3>
          {topStocksBySentiment.length === 0 ? (
            <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>Chưa có dữ liệu</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topStocksBySentiment} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="symbol" stroke="transparent" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis stroke="transparent" tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: 'rgba(37,99,235,0.05)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Positive" stackId="s" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Neutral" stackId="s" fill="#64748b" />
                <Bar dataKey="Negative" stackId="s" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="section-card">
        <h3 className="text-[13px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Sentiment theo thời gian</h3>
        <p className="text-[11px] mb-4" style={{ color: 'var(--text-faint)' }}>30 ngày gần nhất có tin đã phân tích</p>
        {byDate.length === 0 ? (
          <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>Chưa có dữ liệu</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byDate} barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="date" stroke="transparent" tick={{ fill: '#64748b', fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis stroke="transparent" tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: 'rgba(37,99,235,0.05)' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Positive" stackId="d" fill="#10b981" />
              <Bar dataKey="Neutral" stackId="d" fill="#64748b" />
              <Bar dataKey="Negative" stackId="d" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
