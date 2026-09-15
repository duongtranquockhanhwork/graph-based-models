import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Activity,
  LineChart as LineChartIcon,
  Network,
  Newspaper,
  Pause,
  RefreshCw,
  Star,
} from 'lucide-react'
import { analyticsApi, graphApi, newsApi, predictionApi } from '../services/api'
import { useLanguage } from '../context/LanguageContext'
import stockDetailApi from '../services/stockDetailApi'
import watchlistApi from '../services/watchlistApi'
import type {
  Candle,
  GraphData,
  LiveQuote,
  NewsArticle,
  PriceBand,
  StockAggregation,
  StockOverview,
  StockPrediction,
} from '../types'
import PriceChart from '../components/Charts/PriceChart'
import NewsCard from '../components/news/NewsCard'
import CompanyTabs from '../components/stock/CompanyTabs'
import PriceBandPanel from '../components/stock/PriceBandPanel'
import { SENTIMENT_COLORS, SymbolChip } from '../components/common/Chips'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { fmtNumber, trendColor, COLOR_CEILING, COLOR_FLOOR, COLOR_REFERENCE } from '../utils/stockColors'

const RANGES = [
  { key: 'm1', days: 30 },
  { key: 'm3', days: 90 },
  { key: 'm6', days: 180 },
  { key: 'y1', days: 365 },
  { key: 'y5', days: 1825 },
] as const

interface GraphFeatures {
  degree_centrality?: number
  betweenness_centrality?: number
  mention_frequency?: number
  positive_news_count?: number
  negative_news_count?: number
  sentiment_ratio?: number
}

function Section({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string
  icon: React.ElementType
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="section-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Icon size={15} /> {title}
        </h3>
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

/** Hồ sơ mã — mọi thứ hệ thống biết về một mã, ở một nơi.
 *
 * Trước đây thông tin về một mã nằm rải ở bốn trang: giá ở Bảng giá Live,
 * số tin ở Cổ phiếu, dự đoán ở Dự đoán xu hướng, quan hệ ở Knowledge Graph —
 * và không trang nào dẫn sang trang kia. Đây là điểm hội tụ: giá, biểu đồ,
 * kết luận của mô hình kèm bằng chứng, lân cận đồ thị, và tin liên quan.
 */
export default function StockWorkspacePage() {
  const { symbol = '' } = useParams()
  const sym = symbol.toUpperCase()
  const { t } = useLanguage()

  const [info, setInfo] = useState<StockAggregation | null>(null)
  const [overview, setOverview] = useState<StockOverview | null>(null)
  const [prediction, setPrediction] = useState<StockPrediction | null>(null)
  const [features, setFeatures] = useState<GraphFeatures>({})
  const [news, setNews] = useState<NewsArticle[]>([])
  const [neighbourhood, setNeighbourhood] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)

  const [candles, setCandles] = useState<Candle[]>([])
  const [days, setDays] = useState(180)
  const [candlesLoading, setCandlesLoading] = useState(true)

  const [priceBand, setPriceBand] = useState<PriceBand | null>(null)
  const [priceBandLoading, setPriceBandLoading] = useState(true)

  const [quote, setQuote] = useState<LiveQuote | null>(null)
  const [watching, setWatching] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      analyticsApi
        .stocks()
        .then((r) => setInfo((r.data as StockAggregation[]).find((s) => s.symbol === sym) || null))
        .catch(() => setInfo(null)),
      stockDetailApi.overview(sym).then((r) => setOverview(r.data)).catch(() => setOverview(null)),
      predictionApi.forStock(sym).then((r) => setPrediction(r.data)).catch(() => setPrediction(null)),
      graphApi.stockFeatures(sym).then((r) => setFeatures(r.data || {})).catch(() => setFeatures({})),
      newsApi.list({ stock: sym, limit: 20 }).then((r) => setNews(r.data)).catch(() => setNews([])),
      graphApi
        .data({ stock: sym, limit: 60 })
        .then((r) => setNeighbourhood(r.data))
        .catch(() => setNeighbourhood(null)),
    ]).finally(() => setLoading(false))
  }, [sym])

  useEffect(() => {
    setPriceBandLoading(true)
    stockDetailApi
      .priceBand(sym)
      .then((r) => setPriceBand(r.data))
      .catch(() => setPriceBand(null))
      .finally(() => setPriceBandLoading(false))
  }, [sym])

  const loadCandles = useCallback(async () => {
    try {
      const r = await stockDetailApi.history(sym, days)
      setCandles(r.data)
    } catch {
      setCandles([])
    } finally {
      setCandlesLoading(false)
    }
  }, [sym, days])

  const loadQuote = useCallback(async () => {
    try {
      const r = await watchlistApi.live()
      const found = r.data.find((q) => q.symbol === sym) || null
      setQuote(found)
      setWatching(!!found)
    } catch {
      /* giữ giá cũ */
    }
  }, [sym])

  const refreshAll = useCallback(async () => {
    await Promise.all([loadCandles(), loadQuote()])
  }, [loadCandles, loadQuote])

  // Đổi khung thời gian phải thấy kết quả NGAY.
  //
  // useAutoRefresh giữ hàm nạp trong một ref và chỉ gọi lại theo nhịp hẹn giờ,
  // nên khi `days` đổi thì hàm mới đã sẵn sàng nhưng không ai gọi nó. Người
  // dùng bấm "1T", nút sáng lên, và biểu đồ đứng yên cho tới nhịp kế tiếp —
  // ngoài giờ giao dịch nhịp đó là 180 giây, đủ lâu để ai cũng kết luận là
  // nút bị hỏng.
  //
  // Bỏ qua lần chạy đầu: lúc mount, useAutoRefresh đã tự nạp một lần rồi.
  const skipFirstCandleLoad = useRef(true)
  useEffect(() => {
    if (skipFirstCandleLoad.current) {
      skipFirstCandleLoad.current = false
      return
    }
    setCandlesLoading(true)
    void loadCandles()
  }, [loadCandles])

  const { lastUpdated, secondsLeft, paused, marketOpen, refreshing, refreshNow } = useAutoRefresh(
    refreshAll,
    { intervalMs: 30000 },
  )

  const toggleWatch = async () => {
    try {
      if (watching) {
        await watchlistApi.remove(sym)
        setWatching(false)
        toast.success(t('stocks.toast.removeSuccess', { symbol: sym }))
      } else {
        await watchlistApi.add(sym)
        setWatching(true)
        toast.success(t('stocks.toast.quickAddSuccess', { symbol: sym }))
        refreshNow()
      }
    } catch {
      toast.error(t('stockWorkspace.watchToggleError'))
    }
  }

  const sentimentTotal = info
    ? Object.values(info.sentiment_distribution).reduce((a, b) => a + b, 0)
    : 0

  // Mã lân cận trong đồ thị: cùng ngành hoặc cùng xuất hiện trong tin.
  const peers = useMemo(() => {
    if (!neighbourhood) return []
    return neighbourhood.nodes
      .filter((n) => n.type === 'stock' && n.id !== sym)
      .map((n) => n.id)
      .slice(0, 10)
  }, [neighbourhood, sym])

  const scoredNews = news.filter((n) => n.predicted_trend)

  return (
    <div className="p-4 sm:p-6 space-y-4 fade-in">
      <Link
        to="/stocks"
        className="inline-flex items-center gap-1.5 text-[12px]"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={14} /> {t('stockWorkspace.backToStocks')}
      </Link>

      {/* Đầu trang: danh tính + giá */}
      <div className="section-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {sym}
              </h2>
              {quote?.exchange && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}
                >
                  {quote.exchange}
                </span>
              )}
              <button
                onClick={toggleWatch}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
                style={
                  watching
                    ? { background: 'rgba(16,185,129,0.12)', color: '#0b7d5a', border: '1px solid rgba(16,185,129,0.25)' }
                    : { border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }
                }
              >
                <Star size={11} fill={watching ? 'currentColor' : 'none'} />
                {watching ? t('stockWorkspace.watching') : t('stockWorkspace.watch')}
              </button>
            </div>
            <p className="text-[13px] mt-1" style={{ color: 'var(--text-secondary)' }}>
              {info?.company || overview?.organ_name || quote?.company_name || t('stockWorkspace.unknownCompany')}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
              {info?.industry || overview?.sector || '—'}
            </p>
          </div>

          {quote ? (
            <div className="text-right">
              <p className="text-3xl font-bold tabular-nums leading-none" style={{ color: trendColor(quote.change) }}>
                {fmtNumber(quote.price)}
              </p>
              <p className="text-[13px] mt-1 tabular-nums" style={{ color: trendColor(quote.change) }}>
                {quote.change > 0 ? '+' : ''}
                {fmtNumber(quote.change)} ({quote.percent_change > 0 ? '+' : ''}
                {quote.percent_change.toFixed(2)}%)
              </p>
              <p className="text-[11px] mt-1 tabular-nums">
                <span style={{ color: COLOR_CEILING }}>{fmtNumber(quote.ceiling)}</span>
                {' / '}
                <span style={{ color: COLOR_REFERENCE }}>{fmtNumber(quote.reference_price)}</span>
                {' / '}
                <span style={{ color: COLOR_FLOOR }}>{fmtNumber(quote.floor)}</span>
              </p>
              <div className="flex items-center justify-end gap-2 mt-1.5 text-[10px]" style={{ color: 'var(--text-faint)' }}>
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: marketOpen ? '#10b981' : '#94a3b8' }} />
                  {marketOpen ? t('stockWorkspace.inSession') : t('stockWorkspace.outOfSession')}
                </span>
                {paused ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Pause size={9} /> {t('stockWorkspace.paused')}
                  </span>
                ) : (
                  secondsLeft !== null && <span>{secondsLeft}s</span>
                )}
                <button onClick={refreshNow} aria-label={t('stockWorkspace.refreshPriceAriaLabel')} disabled={refreshing}>
                  <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
          ) : (
            <div className="text-right">
              <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
                {t('stockWorkspace.noQuoteYet')}
              </p>
              <button
                onClick={toggleWatch}
                className="mt-1 text-[12px] hover:underline"
                style={{ color: '#2563eb' }}
              >
                {t('stockWorkspace.watchToSeePrice')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Biểu đồ */}
      <Section
        title={t('stockWorkspace.priceChartTitle')}
        icon={LineChartIcon}
        action={
          <div className="flex items-center gap-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => {
                  setCandlesLoading(true)
                  setDays(r.days)
                }}
                className="px-2.5 py-1 rounded-lg text-[11px] transition-all"
                style={
                  days === r.days
                    ? { background: 'rgba(37,99,235,0.18)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.3)' }
                    : { color: 'var(--text-muted)', border: '1px solid transparent' }
                }
              >
                {t(`stockWorkspace.ranges.${r.key}`)}
              </button>
            ))}
          </div>
        }
      >
        {candlesLoading ? (
          <div className="skeleton h-80 rounded-2xl" />
        ) : (
          <PriceChart candles={candles} height={300} volumeHeight={90} />
        )}
        {lastUpdated && (
          <p className="text-[11px] mt-2" style={{ color: 'var(--text-faint)' }}>
            {t('stockWorkspace.updatedAt', { time: lastUpdated.toLocaleTimeString('vi-VN') })}
          </p>
        )}
      </Section>

      <PriceBandPanel band={priceBand} loading={priceBandLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Kết luận mô hình */}
        <div className="lg:col-span-2">
          <Section
            title={t('stockWorkspace.modelVerdict.title')}
            icon={Activity}
            action={
              <Link to="/reports" className="text-[11px] hover:underline" style={{ color: '#2563eb' }}>
                {t('stockWorkspace.modelVerdict.accuracyLink')}
              </Link>
            }
          >
            {loading ? (
              <div className="skeleton h-24 rounded-xl" />
            ) : scoredNews.length === 0 ? (
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                {t('stockWorkspace.modelVerdict.noNewsPre')} {sym} {t('stockWorkspace.modelVerdict.noNewsMid')}{' '}
                <Link to="/import" className="hover:underline" style={{ color: '#2563eb' }}>
                  {t('stockWorkspace.modelVerdict.importLink')}
                </Link>{' '}
                {t('stockWorkspace.modelVerdict.importSuffix')}
              </p>
            ) : (
              <>
                <p className="text-[12px] mb-3" style={{ color: 'var(--text-muted)' }}>
                  {t('stockWorkspace.modelVerdict.summary', { count: scoredNews.length, symbol: sym })}
                </p>
                <div className="space-y-2.5">
                  {scoredNews.slice(0, 3).map((n) => (
                    <NewsCard key={n.id} news={n} hideSymbol={sym} />
                  ))}
                </div>
              </>
            )}

            {prediction?.explanation?.engine === 'heuristic' && (
              <p
                className="text-[11px] mt-3 px-2.5 py-2 rounded-lg"
                style={{ background: 'rgba(180,83,9,0.08)', color: '#b45309' }}
              >
                {t('stockWorkspace.modelVerdict.heuristicPre')}{' '}
                <strong>
                  {prediction.trend === 'INCREASING'
                    ? t('stockWorkspace.modelVerdict.trendIncreasing')
                    : prediction.trend === 'DECREASING'
                      ? t('stockWorkspace.modelVerdict.trendDecreasing')
                      : t('stockWorkspace.modelVerdict.trendFlat')}
                </strong>
                {t('stockWorkspace.modelVerdict.heuristicMid')} <strong>{t('stockWorkspace.modelVerdict.heuristicNot')}</strong>{' '}
                {t('stockWorkspace.modelVerdict.heuristicPost')}
              </p>
            )}
          </Section>
        </div>

        {/* Lân cận đồ thị */}
        <Section
          title={t('stockWorkspace.related.title')}
          icon={Network}
          action={
            <Link to={`/graph?stock=${sym}`} className="text-[11px] hover:underline" style={{ color: '#2563eb' }}>
              {t('stockWorkspace.related.graphLink')}
            </Link>
          }
        >
          {loading ? (
            <div className="skeleton h-32 rounded-xl" />
          ) : (
            <>
              <div className="space-y-2.5 mb-3">
                <Row label={t('stockWorkspace.related.mentionCount')} value={info?.mention_count ?? features.mention_frequency ?? 0} />
                <Row
                  label={t('stockWorkspace.related.linkLevel')}
                  value={features.degree_centrality != null ? `${Math.round(features.degree_centrality * 100)}%` : '—'}
                />
                <Row
                  label={t('stockWorkspace.related.positiveNews')}
                  value={features.positive_news_count ?? 0}
                  accent={SENTIMENT_COLORS.Positive}
                />
                <Row
                  label={t('stockWorkspace.related.negativeNews')}
                  value={features.negative_news_count ?? 0}
                  accent={SENTIMENT_COLORS.Negative}
                />
              </div>

              {peers.length > 0 && (
                <div className="pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <p className="text-[11px] mb-1.5" style={{ color: 'var(--text-faint)' }}>
                    {t('stockWorkspace.related.frequentPeers')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {peers.map((p) => (
                      <SymbolChip key={p} symbol={p} size="sm" />
                    ))}
                  </div>
                </div>
              )}

              {sentimentTotal > 0 && info && (
                <div className="pt-3 mt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <p className="text-[11px] mb-1.5" style={{ color: 'var(--text-faint)' }}>
                    {t('stockWorkspace.related.goodBadNews', { count: sentimentTotal })}
                  </p>
                  <div className="flex h-2 rounded-full overflow-hidden mb-1.5" style={{ background: 'var(--bg-surface)' }}>
                    {(['Positive', 'Neutral', 'Negative'] as const).map((k) =>
                      info.sentiment_distribution[k] ? (
                        <div
                          key={k}
                          style={{
                            width: `${(info.sentiment_distribution[k] / sentimentTotal) * 100}%`,
                            background: SENTIMENT_COLORS[k],
                          }}
                        />
                      ) : null,
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {(['Positive', 'Neutral', 'Negative'] as const).map((k) =>
                      info.sentiment_distribution[k] ? (
                        <Link
                          key={k}
                          to={`/feed?stock=${sym}&sentiment=${k}`}
                          className="text-[10px] hover:underline"
                          style={{ color: SENTIMENT_COLORS[k] }}
                        >
                          {t(`chips.sentiment.${k}`)}: {info.sentiment_distribution[k]}
                        </Link>
                      ) : null,
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </Section>
      </div>

      {/* Chi tiết doanh nghiệp — trước đây chỉ xem được trong cửa sổ bật lên
          của Bảng giá Live, tức là không ai tìm ra. */}
      <CompanyTabs symbol={sym} quote={quote} />

      {/* Tin liên quan */}
      <Section
        title={t('stockWorkspace.news.title', { symbol: sym })}
        icon={Newspaper}
        action={
          <Link to={`/feed?stock=${sym}`} className="text-[11px] hover:underline" style={{ color: '#2563eb' }}>
            {t('stockWorkspace.news.viewAll')}
          </Link>
        }
      >
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton h-20 rounded-xl" />
            ))}
          </div>
        ) : news.length === 0 ? (
          <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
            {t('stockWorkspace.news.noneYetPre')} {sym}.{' '}
            <Link to="/import" className="hover:underline" style={{ color: '#2563eb' }}>
              {t('stockWorkspace.news.importLink')}
            </Link>{' '}
            {t('stockWorkspace.news.importSuffix')}
          </p>
        ) : (
          <div className="space-y-2.5">
            {news.slice(0, 8).map((n) => (
              <NewsCard key={n.id} news={n} hideSymbol={sym} />
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
