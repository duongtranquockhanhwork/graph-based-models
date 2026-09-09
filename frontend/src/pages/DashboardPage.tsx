import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowRight,
  Building2,
  Network,
  Newspaper,
  ShieldCheck,
  TrendingUp,
  Upload,
} from 'lucide-react'
import { analyticsApi, newsApi, predictionApi } from '../services/api'
import type { DashboardStats, ModelInfo, NewsArticle } from '../types'
import NewsCard from '../components/news/NewsCard'
import {
  EVENT_LABELS,
  SENTIMENT_COLORS,
  SENTIMENT_LABELS,
  SymbolChip,
} from '../components/common/Chips'

const CHART_TOOLTIP_STYLE = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--text-primary)',
}

/** Ô số liệu — luôn dẫn tới lát cắt tương ứng, không phải một con số chết. */
function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  to,
}: {
  icon: React.ElementType
  label: string
  value: number
  sub: string
  accent: string
  to: string
}) {
  return (
    <Link
      to={to}
      className="section-card card-glow flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 transition-transform hover:-translate-y-0.5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div
        className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: accent + '22', border: `1px solid ${accent}33` }}
      >
        <Icon size={20} style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
        <p className="text-2xl font-bold leading-none tabular-nums" style={{ color: 'var(--text-primary)' }}>
          {value.toLocaleString('vi-VN')}
        </p>
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-faint)' }}>
          {sub}
        </p>
      </div>
    </Link>
  )
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="section-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function EmptyState() {
  const steps = [
    { n: '1', t: 'Nhập dữ liệu', d: 'Tải CSV, dán link báo, hoặc nhập tay' },
    { n: '2', t: 'Hệ thống đọc bài', d: 'Tìm mã cổ phiếu, việc gì xảy ra, tin tốt hay xấu' },
    { n: '3', t: 'Xem kết quả', d: 'Dòng tin, thông tin từng mã, và sơ đồ liên kết' },
  ]
  return (
    <div className="p-4 sm:p-6 fade-in">
      <div
        className="rounded-2xl px-6 py-12 flex flex-col items-center text-center"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)' }}
        >
          <Newspaper size={24} className="text-white" />
        </div>
        <h2 className="text-[20px] font-bold" style={{ color: 'var(--text-primary)' }}>
          Bắt đầu bằng việc nhập tin tức
        </h2>
        <p className="text-[13px] mt-2 max-w-lg" style={{ color: 'var(--text-muted)' }}>
          Hệ thống đọc bài báo tài chính tiếng Việt, tìm ra bài nói về mã cổ phiếu nào và
          chuyện gì xảy ra, rồi ước lượng giá thường phản ứng thế nào sau loại tin đó.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 w-full max-w-2xl text-left">
          {steps.map((s) => (
            <div
              key={s.n}
              className="rounded-xl p-3.5"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[11px] font-bold text-white mb-1.5"
                style={{ background: '#2563eb' }}
              >
                {s.n}
              </span>
              <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                {s.t}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {s.d}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 justify-center mt-6">
          <Link
            to="/import"
            className="px-5 py-2.5 rounded-xl text-[13px] font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)' }}
          >
            Nhập dữ liệu ngay
          </Link>
          <Link
            to="/stocks"
            className="px-5 py-2.5 rounded-xl text-[13px] font-medium"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            Xem bảng giá thị trường
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recent, setRecent] = useState<NewsArticle[]>([])
  const [model, setModel] = useState<ModelInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      analyticsApi.dashboard().then((r) => setStats(r.data)),
      newsApi.list({ limit: 5 }).then((r) => setRecent(r.data)).catch(() => setRecent([])),
      predictionApi.modelInfo().then((r) => setModel(r.data)).catch(() => setModel(null)),
    ]).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-56 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[13px]" style={{ color: '#dc2626' }}>
          Không tải được dữ liệu tổng quan
        </p>
      </div>
    )
  }

  if (stats.total_news === 0) return <EmptyState />

  const sentimentEntries = Object.entries(stats.sentiment_distribution)
  const sentimentTotal = sentimentEntries.reduce((a, [, v]) => a + v, 0)
  const eventEntries = Object.entries(stats.trend_distribution)

  return (
    <div className="p-4 sm:p-6 space-y-4 fade-in">
      {/* Số liệu — mỗi ô là một lối vào */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatTile
          icon={Newspaper}
          label="Bài báo"
          value={stats.total_news}
          sub={`${stats.analyzed_news} đã phân tích`}
          accent="#2563eb"
          to="/feed"
        />
        <StatTile
          icon={TrendingUp}
          label="Mã cổ phiếu"
          value={stats.total_stocks}
          sub="Tìm thấy trong các bài báo"
          accent="#0b7d5a"
          to="/stocks"
        />
        <StatTile
          icon={Building2}
          label="Công ty"
          value={stats.total_companies}
          sub="Có trong sơ đồ liên kết"
          accent="#b45309"
          to="/graph"
        />
        <StatTile
          icon={Network}
          label="Ngành nghề"
          value={stats.top_industries.length}
          sub="Có trong sơ đồ liên kết"
          accent="#7c3aed"
          to="/graph"
        />
      </div>

      {/* Trạng thái mô hình — trả lời "có đáng tin không" ngay từ trang đầu */}
      {model?.available && model.performance && (
        <Link
          to="/reports"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 transition-colors"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldCheck size={16} style={{ color: '#0b7d5a' }} />
            <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              Phần dự đoán đã được kiểm tra trên hàng nghìn bài báo cũ và{' '}
              <strong style={{ color: '#0b7d5a' }}>
                đoán đúng hơn cách làm đơn giản {(model.performance.delta_vs_baseline * 100).toFixed(1)} điểm
              </strong>
              . Kết quả vẫn khiêm tốn — hãy đọc như một gợi ý, không phải lời khuyên mua bán.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-[12px] flex-shrink-0" style={{ color: '#2563eb' }}>
            Xem chi tiết <ArrowRight size={12} />
          </span>
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cảm xúc — bấm vào để lọc dòng tin */}
        <SectionCard
          title="Tin tốt hay tin xấu"
          action={
            <Link to="/feed" className="text-[11px] hover:underline" style={{ color: '#2563eb' }}>
              Mở dòng tin
            </Link>
          }
        >
          <div className="space-y-2.5">
            {sentimentEntries.map(([name, value]) => (
              <Link
                key={name}
                to={`/feed?sentiment=${name}`}
                className="block"
                title={`Lọc tin ${SENTIMENT_LABELS[name] || name}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                    {SENTIMENT_LABELS[name] || name}
                  </span>
                  <span className="text-[12px] font-semibold tabular-nums" style={{ color: SENTIMENT_COLORS[name] }}>
                    {value}
                  </span>
                </div>
                <div className="conf-bar">
                  <div
                    className="conf-bar-fill"
                    style={{
                      width: `${sentimentTotal ? (value / sentimentTotal) * 100 : 0}%`,
                      background: SENTIMENT_COLORS[name],
                    }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>

        {/* Kết luận mô hình */}
        <SectionCard
          title="Hệ thống dự đoán ra sao"
          action={
            <Link to="/feed" className="text-[11px] hover:underline" style={{ color: '#2563eb' }}>
              Xem chi tiết
            </Link>
          }
        >
          {eventEntries.length === 0 ? (
            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
              Chưa có bài nào được hệ thống dự đoán.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={eventEntries.map(([name, value]) => ({ name, value }))} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  tickFormatter={(v) => (v === 'INCREASING' ? 'Có thể tăng' : v === 'DECREASING' ? 'Có thể giảm' : 'Ít biến động')}
                />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {eventEntries.map(([name]) => (
                    <Cell
                      key={name}
                      fill={name === 'INCREASING' ? '#0b7d5a' : name === 'DECREASING' ? '#c0392e' : '#64748b'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* Ngành — bấm để lọc */}
        <SectionCard
          title="Ngành được nhắc nhiều"
          action={
            <Link to="/graph" className="text-[11px] hover:underline" style={{ color: '#2563eb' }}>
              Xem đồ thị
            </Link>
          }
        >
          <div className="space-y-2.5">
            {stats.top_industries.slice(0, 6).map((item, idx) => {
              const max = stats.top_industries[0]?.count || 1
              return (
                <div key={item.industry}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[12px] truncate pr-2" style={{ color: 'var(--text-secondary)' }}>
                      {idx + 1}. {item.industry}
                    </span>
                    <span className="text-[11px] font-semibold flex-shrink-0 tabular-nums" style={{ color: '#2563eb' }}>
                      {item.count}
                    </span>
                  </div>
                  <div className="conf-bar">
                    <div className="conf-bar-fill" style={{ width: `${(item.count / max) * 100}%`, background: '#2563eb' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tin mới nhất — dùng chung NewsCard, bấm mã là sang hồ sơ mã */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Tin mới nhất"
            action={
              <Link to="/feed" className="text-[11px] hover:underline" style={{ color: '#2563eb' }}>
                Xem tất cả
              </Link>
            }
          >
            {recent.length === 0 ? (
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                Chưa có bài báo nào.{' '}
                <Link to="/import" className="hover:underline" style={{ color: '#2563eb' }}>
                  Nhập dữ liệu
                </Link>
              </p>
            ) : (
              <div className="space-y-2.5">
                {recent.slice(0, 4).map((n) => (
                  <NewsCard key={n.id} news={n} />
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard
            title="Mã được nhắc nhiều"
            action={
              <Link to="/stocks" className="text-[11px] hover:underline" style={{ color: '#2563eb' }}>
                Tất cả mã
              </Link>
            }
          >
            {stats.top_stocks.length === 0 ? (
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                Chưa nhận diện được mã nào.
              </p>
            ) : (
              <div className="space-y-2">
                {stats.top_stocks.slice(0, 8).map((s) => (
                  <div key={s.symbol} className="flex items-center justify-between gap-2">
                    <SymbolChip symbol={s.symbol} />
                    <div className="flex-1 conf-bar">
                      <div
                        className="conf-bar-fill"
                        style={{
                          width: `${(s.count / (stats.top_stocks[0]?.count || 1)) * 100}%`,
                          background: '#2563eb',
                        }}
                      />
                    </div>
                    <span className="text-[11px] tabular-nums w-6 text-right" style={{ color: 'var(--text-faint)' }}>
                      {s.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {stats.news_by_date.length > 1 && (
            <SectionCard title="Tin theo ngày">
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={stats.news_by_date} margin={{ top: 6, right: 6, left: -24, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-faint)' }} minTickGap={30} />
                  <YAxis tick={{ fontSize: 9, fill: 'var(--text-faint)' }} allowDecimals={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={1.6} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </SectionCard>
          )}
        </div>
      </div>

      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
        style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-subtle)' }}
      >
        <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
          Có <strong style={{ color: 'var(--text-primary)' }}>{Object.values(EVENT_LABELS).length}</strong> loại
          sự việc để lọc trong Dòng tin, và sơ đồ liên kết cho thấy các mã ảnh hưởng gián tiếp tới nhau.
        </p>
        <div className="flex gap-2">
          <Link
            to="/import"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)' }}
          >
            <Upload size={12} /> Nhập thêm dữ liệu
          </Link>
        </div>
      </div>
    </div>
  )
}
