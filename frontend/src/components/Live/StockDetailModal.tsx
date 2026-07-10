import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import stockDetailApi from '../../services/stockDetailApi'
import { newsApi } from '../../services/api'
import type { LiveQuote, StockOverview, Shareholder, CompanyEvent, FinancialStatements, NewsArticle } from '../../types'
import { trendColor, fmtNumber, COLOR_CEILING, COLOR_FLOOR, COLOR_REFERENCE } from '../../utils/stockColors'
import { SentimentBadge } from '../Admin/AdminWidgets'
import GiaoDichTab from './GiaoDichTab'

const TABS = [
  { key: 'giao-dich', label: 'Giao dịch' },
  { key: 'ho-so', label: 'Hồ sơ' },
  { key: 'co-dong', label: 'Cổ đông' },
  { key: 'von-co-tuc', label: 'Vốn và cổ tức' },
  { key: 'tin-tuc', label: 'Tin tức' },
  { key: 'su-kien', label: 'Lịch sự kiện' },
  { key: 'thong-ke', label: 'Thống kê' },
  { key: 'tai-chinh', label: 'Tài chính' },
] as const
type TabKey = (typeof TABS)[number]['key']

function EmptyState({ text }: { text: string }) {
  return <p className="text-[12px] py-8 text-center" style={{ color: 'var(--text-faint)' }}>{text}</p>
}

function Loading() {
  return (
    <div className="space-y-2 py-2">
      {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-8 rounded-lg" />)}
    </div>
  )
}

export default function StockDetailModal({
  symbol,
  quote,
  onClose,
}: {
  symbol: string
  quote: LiveQuote | null
  onClose: () => void
}) {
  const [tab, setTab] = useState<TabKey>('giao-dich')

  const [overview, setOverview] = useState<StockOverview | null>()
  const [shareholders, setShareholders] = useState<Shareholder[]>()
  const [events, setEvents] = useState<CompanyEvent[]>()
  const [financials, setFinancials] = useState<FinancialStatements>()
  const [news, setNews] = useState<NewsArticle[]>()

  useEffect(() => {
    if (tab === 'ho-so' || tab === 'thong-ke' || tab === 'von-co-tuc') {
      if (overview === undefined) stockDetailApi.overview(symbol).then((r) => setOverview(r.data)).catch(() => setOverview(null))
    }
    if (tab === 'co-dong' && shareholders === undefined) {
      stockDetailApi.shareholders(symbol).then((r) => setShareholders(r.data)).catch(() => setShareholders([]))
    }
    if (tab === 'su-kien' && events === undefined) {
      stockDetailApi.events(symbol).then((r) => setEvents(r.data)).catch(() => setEvents([]))
    }
    if (tab === 'tai-chinh' && financials === undefined) {
      stockDetailApi
        .financials(symbol)
        .then((r) => setFinancials(r.data))
        .catch(() => setFinancials({ income_statement: [], balance_sheet: [], cash_flow: [], available: false }))
    }
    if (tab === 'tin-tuc' && news === undefined) {
      newsApi.list({ stock: symbol, limit: 30 }).then((r) => setNews(r.data)).catch(() => setNews([]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, symbol])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!quote) return null

  const years = (rows: FinancialStatements['income_statement']) => {
    if (!rows || rows.length === 0) return []
    return Object.keys(rows[0]).filter((k) => /^\d{4}$/.test(k)).sort().reverse()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-2xl fade-in"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{quote.symbol}</h2>
            {quote.exchange && (
              <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-surface)', color: 'var(--text-faint)', border: '1px solid var(--border-default)' }}>
                {quote.exchange}
              </span>
            )}
            <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{quote.company_name}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--text-faint)' }} title="Đóng">
            <X size={18} />
          </button>
        </div>

        {/* Price strip */}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <p className="text-3xl font-bold" style={{ color: trendColor(quote.change) }}>{fmtNumber(quote.price)}</p>
            <p className="text-[12px] font-medium" style={{ color: trendColor(quote.change) }}>
              {quote.change > 0 ? '+' : ''}{fmtNumber(quote.change)} ({quote.percent_change > 0 ? '+' : ''}{quote.percent_change.toFixed(2)}%)
            </p>
          </div>
          <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            <p>Mở cửa / Trung bình</p>
            <p style={{ color: 'var(--text-primary)' }} className="font-medium">{fmtNumber(quote.open_price)} / {fmtNumber(quote.avg_price)}</p>
          </div>
          <div className="flex items-center gap-4 text-[12px]">
            <div>
              <p style={{ color: 'var(--text-faint)' }}>Trần</p>
              <p style={{ color: COLOR_CEILING }} className="font-semibold">{fmtNumber(quote.ceiling)}</p>
            </div>
            <div>
              <p style={{ color: 'var(--text-faint)' }}>Sàn</p>
              <p style={{ color: COLOR_FLOOR }} className="font-semibold">{fmtNumber(quote.floor)}</p>
            </div>
            <div>
              <p style={{ color: 'var(--text-faint)' }}>Tham chiếu</p>
              <p style={{ color: COLOR_REFERENCE }} className="font-semibold">{fmtNumber(quote.reference_price)}</p>
            </div>
          </div>
          <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            <p>Thấp / Cao</p>
            <p style={{ color: 'var(--text-primary)' }} className="font-medium">{fmtNumber(quote.lowest)} / {fmtNumber(quote.highest)}</p>
          </div>
          <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            <p>Tổng KL</p>
            <p style={{ color: 'var(--text-primary)' }} className="font-medium">{fmtNumber(quote.volume)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 overflow-x-auto" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2.5 text-[13px] whitespace-nowrap transition-colors ${tab === t.key ? 'tab-active' : ''}`}
              style={{ color: tab === t.key ? undefined : 'var(--text-muted)' }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">
          {tab === 'giao-dich' && <GiaoDichTab symbol={symbol} quote={quote} />}

          {tab === 'ho-so' && (
            overview === undefined ? <Loading /> : !overview ? <EmptyState text="Chưa có dữ liệu hồ sơ công ty" /> : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[12px]">
                  <div><p style={{ color: 'var(--text-faint)' }}>Ngành</p><p style={{ color: 'var(--text-primary)' }} className="font-medium">{overview.sector || '—'}</p></div>
                  <div><p style={{ color: 'var(--text-faint)' }}>Vốn hoá</p><p style={{ color: 'var(--text-primary)' }} className="font-medium">{fmtNumber(overview.market_cap)}</p></div>
                  <div><p style={{ color: 'var(--text-faint)' }}>Ngày niêm yết</p><p style={{ color: 'var(--text-primary)' }} className="font-medium">{overview.listing_date?.slice(0, 10) || '—'}</p></div>
                  <div><p style={{ color: 'var(--text-faint)' }}>% Sở hữu nước ngoài</p><p style={{ color: 'var(--text-primary)' }} className="font-medium">{overview.foreigner_percentage != null ? `${(overview.foreigner_percentage * 100).toFixed(1)}%` : '—'}</p></div>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{overview.company_profile || 'Chưa có mô tả công ty'}</p>
              </div>
            )
          )}

          {tab === 'co-dong' && (
            shareholders === undefined ? <Loading /> : shareholders.length === 0 ? <EmptyState text="Chưa có dữ liệu cổ đông" /> : (
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ color: 'var(--text-faint)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th className="text-left font-medium py-2">Cổ đông</th>
                    <th className="text-right font-medium py-2">Số lượng CP</th>
                    <th className="text-right font-medium py-2">% sở hữu</th>
                  </tr>
                </thead>
                <tbody>
                  {shareholders.map((s, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td className="py-2" style={{ color: 'var(--text-primary)' }}>{s.share_holder}</td>
                      <td className="py-2 text-right" style={{ color: 'var(--text-secondary)' }}>{fmtNumber(s.quantity)}</td>
                      <td className="py-2 text-right" style={{ color: 'var(--text-secondary)' }}>{(s.share_own_percent * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {tab === 'von-co-tuc' && (
            overview === undefined ? <Loading /> : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-[12px]">
                  <div><p style={{ color: 'var(--text-faint)' }}>Số CP đang lưu hành</p><p style={{ color: 'var(--text-primary)' }} className="font-medium">{fmtNumber(overview?.issue_share)}</p></div>
                  <div><p style={{ color: 'var(--text-faint)' }}>Cổ tức / CP (ước tính)</p><p style={{ color: 'var(--text-primary)' }} className="font-medium">{fmtNumber(overview?.dividend_per_share_tsr)}</p></div>
                </div>
                <EmptyState text="Chưa có dữ liệu lịch sử vốn/cổ tức chi tiết theo từng đợt" />
              </div>
            )
          )}

          {tab === 'tin-tuc' && (
            news === undefined ? <Loading /> : news.length === 0 ? <EmptyState text="Chưa có tin tức nào nhắc đến mã này" /> : (
              <div className="space-y-2">
                {news.map((n) => (
                  <div key={n.id} className="flex items-start justify-between gap-3 py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>{n.source || '—'} · {n.published_date || '—'}</p>
                    </div>
                    <SentimentBadge sentiment={n.sentiment} />
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'su-kien' && (
            events === undefined ? <Loading /> : events.length === 0 ? <EmptyState text="Chưa có sự kiện nào" /> : (
              <div className="space-y-2">
                {events.map((ev) => (
                  <div key={ev.id} className="py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <p className="text-[13px]" style={{ color: 'var(--text-primary)' }}>{ev.event_title_vi || ev.event_title_en}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>{ev.action_type_vi || ''} · {ev.public_date?.slice(0, 10) || ''}</p>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'thong-ke' && (
            overview === undefined ? <Loading /> : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-[12px]">
                <div><p style={{ color: 'var(--text-faint)' }}>KL khớp TB 1 tháng</p><p style={{ color: 'var(--text-primary)' }} className="font-medium">{fmtNumber(overview?.average_match_volume1_month)}</p></div>
                <div><p style={{ color: 'var(--text-faint)' }}>GT khớp TB 1 tháng</p><p style={{ color: 'var(--text-primary)' }} className="font-medium">{fmtNumber(overview?.average_match_value1_month)}</p></div>
                <div><p style={{ color: 'var(--text-faint)' }}>Cao nhất 52 tuần</p><p style={{ color: 'var(--text-primary)' }} className="font-medium">{fmtNumber(overview?.highest_price1_year)}</p></div>
                <div><p style={{ color: 'var(--text-faint)' }}>Thấp nhất 52 tuần</p><p style={{ color: 'var(--text-primary)' }} className="font-medium">{fmtNumber(overview?.lowest_price1_year)}</p></div>
                <div><p style={{ color: 'var(--text-faint)' }}>% Nhà nước sở hữu</p><p style={{ color: 'var(--text-primary)' }} className="font-medium">{overview?.state_percentage != null ? `${(overview.state_percentage * 100).toFixed(1)}%` : '—'}</p></div>
                <div><p style={{ color: 'var(--text-faint)' }}>Giá mục tiêu (khuyến nghị)</p><p style={{ color: 'var(--text-primary)' }} className="font-medium">{fmtNumber(overview?.target_price)}</p></div>
              </div>
            )
          )}

          {tab === 'tai-chinh' && (
            financials === undefined ? <Loading /> : !financials.available ? <EmptyState text="Chưa có dữ liệu báo cáo tài chính" /> : (
              <div className="space-y-6">
                <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Giới hạn 4 kỳ gần nhất (gói dữ liệu cộng đồng)</p>
                {([
                  ['Kết quả kinh doanh', financials.income_statement],
                  ['Bảng cân đối kế toán', financials.balance_sheet],
                  ['Lưu chuyển tiền tệ', financials.cash_flow],
                ] as const).map(([title, rows]) =>
                  rows.length === 0 ? null : (
                    <div key={title}>
                      <h4 className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{title}</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr style={{ color: 'var(--text-faint)', borderBottom: '1px solid var(--border-subtle)' }}>
                              <th className="text-left font-medium py-1.5 pr-3">Chỉ tiêu</th>
                              {years(rows).map((y) => <th key={y} className="text-right font-medium py-1.5 pl-3">{y}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, i) => (
                              <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                <td className="py-1.5 pr-3" style={{ color: 'var(--text-secondary)' }}>{row.item}</td>
                                {years(rows).map((y) => (
                                  <td key={y} className="py-1.5 pl-3 text-right" style={{ color: 'var(--text-primary)' }}>
                                    {typeof row[y] === 'number' ? fmtNumber(row[y] as number) : '—'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
