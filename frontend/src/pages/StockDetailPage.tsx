import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Activity, Network, Newspaper } from 'lucide-react'
import { analyticsApi, graphApi, newsApi, predictionApi } from '../services/api'
import type { NewsArticle, Prediction, StockAggregation } from '../types'

interface GraphFeatures {
  degree_centrality?: number
  betweenness_centrality?: number
  mention_frequency?: number
  positive_news_count?: number
  negative_news_count?: number
  sentiment_ratio?: number
}

const TREND_CONFIG = {
  INCREASING: { icon: TrendingUp, color: '#10b981', label: 'Tăng' },
  DECREASING: { icon: TrendingDown, color: '#ef4444', label: 'Giảm' },
  UNCHANGED: { icon: Minus, color: '#64748b', label: 'Ổn định' },
}

export default function StockDetailPage() {
  const { symbol = '' } = useParams()
  const [stockInfo, setStockInfo] = useState<StockAggregation | null>(null)
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [graphFeatures, setGraphFeatures] = useState<GraphFeatures>({})
  const [news, setNews] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      analyticsApi.stocks().then((r) => setStockInfo((r.data as StockAggregation[]).find((s) => s.symbol === symbol) || null)),
      predictionApi.forStock(symbol).then((r) => setPrediction(r.data)).catch(() => setPrediction(null)),
      graphApi.stockFeatures(symbol).then((r) => setGraphFeatures(r.data || {})).catch(() => setGraphFeatures({})),
      newsApi.list({ stock: symbol, limit: 20 }).then((r) => setNews(r.data)).catch(() => setNews([])),
    ]).finally(() => setLoading(false))
  }, [symbol])

  const trendCfg = prediction ? TREND_CONFIG[prediction.trend as keyof typeof TREND_CONFIG] : null
  const TrendIcon = trendCfg?.icon

  const totalSentiment = stockInfo ? Object.values(stockInfo.sentiment_distribution).reduce((a, b) => a + b, 0) : 0

  return (
    <div className="p-6 space-y-5 fade-in">
      <Link to="/stocks" className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft size={14} /> Quay lại danh sách cổ phiếu
      </Link>

      {loading ? (
        <div className="space-y-4">
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-48 rounded-2xl" />
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="section-card">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{symbol}</h2>
                <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{stockInfo?.company || 'Không rõ công ty'}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>{stockInfo?.industry || '—'}</p>
              </div>
              {trendCfg && TrendIcon && (
                <div
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                  style={{ background: trendCfg.color + '18', border: `1px solid ${trendCfg.color}30` }}
                >
                  <TrendIcon size={20} style={{ color: trendCfg.color }} />
                  <div>
                    <p className="text-[13px] font-bold" style={{ color: trendCfg.color }}>{trendCfg.label}</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                      Độ tin cậy {Math.round((prediction?.confidence || 0) * 100)}%
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Graph features */}
            <div className="section-card">
              <h3 className="text-[13px] font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Network size={15} /> Đặc trưng Knowledge Graph
              </h3>
              <div className="space-y-2.5">
                <FeatureRow label="Số lần được nhắc đến" value={stockInfo?.mention_count ?? graphFeatures.mention_frequency ?? 0} />
                <FeatureRow label="Degree Centrality" value={graphFeatures.degree_centrality?.toFixed(4) ?? '—'} />
                <FeatureRow label="Betweenness Centrality" value={graphFeatures.betweenness_centrality?.toFixed(4) ?? '—'} />
                <FeatureRow label="Tin tích cực gần đây" value={graphFeatures.positive_news_count ?? 0} />
                <FeatureRow label="Tin tiêu cực gần đây" value={graphFeatures.negative_news_count ?? 0} />
              </div>
            </div>

            {/* Sentiment breakdown */}
            <div className="section-card">
              <h3 className="text-[13px] font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Activity size={15} /> Phân bố cảm xúc tin tức
              </h3>
              {totalSentiment === 0 ? (
                <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>Chưa có dữ liệu sentiment</p>
              ) : (
                <div className="space-y-3">
                  {(['Positive', 'Neutral', 'Negative'] as const).map((label) => {
                    const count = stockInfo?.sentiment_distribution[label] || 0
                    const pct = totalSentiment > 0 ? Math.round((count / totalSentiment) * 100) : 0
                    const color = label === 'Positive' ? '#10b981' : label === 'Negative' ? '#ef4444' : '#64748b'
                    return (
                      <div key={label}>
                        <div className="flex justify-between mb-1">
                          <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                          <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{count} ({pct}%)</span>
                        </div>
                        <div className="conf-bar">
                          <div className="conf-bar-fill" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Explanation */}
          {prediction?.explanation?.reasons && (
            <div className="section-card">
              <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Lý do dự đoán</h3>
              <ul className="space-y-1">
                {prediction.explanation.reasons.map((r, i) => (
                  <li key={i} className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>· {r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Related news */}
          <div className="section-card">
            <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Newspaper size={15} /> Tin tức liên quan ({news.length})
            </h3>
            {news.length === 0 ? (
              <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>Chưa có tin tức nào nhắc đến mã này</p>
            ) : (
              <div className="space-y-2">
                {news.map((n) => (
                  <div key={n.id} className="py-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                      {n.source || '—'} · {n.published_date || '—'} {n.sentiment && `· ${n.sentiment}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function FeatureRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}
