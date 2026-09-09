import { useEffect, useState } from 'react'
import stockDetailApi from '../../services/stockDetailApi'
import type {
  CompanyEvent,
  FinancialStatements,
  IntradayTrade,
  LiveQuote,
  Shareholder,
  StockOverview,
} from '../../types'
import { fmtNumber } from '../../utils/stockColors'

/** Chi tiết doanh nghiệp — nội dung trước đây nằm trong cửa sổ bật lên của
 *  Bảng giá Live.
 *
 *  Đưa thẳng vào hồ sơ mã. Một cửa sổ bật lên từng là chỗ DUY NHẤT xem được
 *  hồ sơ công ty, cổ đông và báo cáo tài chính: không chia sẻ được đường dẫn,
 *  nút Back không đóng được, và người dùng phải đoán ra rằng cần bấm vào một
 *  dòng trong bảng giá mới thấy.
 *
 *  Mỗi tab tự nạp dữ liệu khi được mở lần đầu, nên mở hồ sơ mã không kéo theo
 *  sáu lần gọi API mà người dùng có thể không cần tới.
 */

const TABS = [
  { key: 'so-lenh', label: 'Sổ lệnh' },
  { key: 'ho-so', label: 'Hồ sơ' },
  { key: 'thong-ke', label: 'Thống kê' },
  { key: 'co-dong', label: 'Cổ đông' },
  { key: 'von-co-tuc', label: 'Vốn và cổ tức' },
  { key: 'su-kien', label: 'Lịch sự kiện' },
  { key: 'tai-chinh', label: 'Tài chính' },
] as const
type TabKey = (typeof TABS)[number]['key']

function EmptyState({ text }: { text: string }) {
  return (
    <p className="text-[12px] py-8 text-center" style={{ color: 'var(--text-faint)' }}>
      {text}
    </p>
  )
}

function Loading() {
  return (
    <div className="space-y-2 py-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton h-8 rounded-lg" />
      ))}
    </div>
  )
}

function DepthRow({
  label,
  bidPrice,
  bidVolume,
  askPrice,
  askVolume,
}: {
  label: string
  bidPrice: number
  bidVolume: number
  askPrice: number
  askVolume: number
}) {
  return (
    <tr style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <td className="py-1.5 text-[11px]" style={{ color: 'var(--text-faint)' }}>{label}</td>
      <td className="py-1.5 text-right text-[12px] tabular-nums" style={{ color: 'var(--text-faint)' }}>{bidVolume ? fmtNumber(bidVolume) : '—'}</td>
      <td className="py-1.5 text-right text-[12px] font-medium tabular-nums" style={{ color: '#10b981' }}>{bidPrice ? fmtNumber(bidPrice) : '—'}</td>
      <td className="py-1.5 pl-3 text-[12px] font-medium tabular-nums" style={{ color: '#ef4444' }}>{askPrice ? fmtNumber(askPrice) : '—'}</td>
      <td className="py-1.5 text-[12px] tabular-nums" style={{ color: 'var(--text-faint)' }}>{askVolume ? fmtNumber(askVolume) : '—'}</td>
    </tr>
  )
}

function OrderBook({ symbol, quote }: { symbol: string; quote: LiveQuote | null }) {
  const [trades, setTrades] = useState<IntradayTrade[] | undefined>()

  useEffect(() => {
    let cancelled = false
    const load = () =>
      stockDetailApi
        .intraday(symbol, 40)
        .then((r) => {
          if (!cancelled) setTrades(r.data)
        })
        .catch(() => {
          if (!cancelled) setTrades([])
        })
    load()
    // Sổ lệnh chỉ đổi trong phiên; 5 giây là nhịp quen thuộc của bảng giá sàn.
    const id = setInterval(load, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [symbol])

  if (!quote) {
    return <EmptyState text="Theo dõi mã này để xem sổ lệnh thời gian thực" />
  }

  const bidTotal = quote.bid_1_volume + quote.bid_2_volume + quote.bid_3_volume
  const askTotal = quote.ask_1_volume + quote.ask_2_volume + quote.ask_3_volume
  const bidPct = bidTotal + askTotal > 0 ? (bidTotal / (bidTotal + askTotal)) * 100 : 50

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-faint)' }}>
          Độ sâu thị trường
        </p>
        <table className="w-full">
          <thead>
            <tr style={{ color: 'var(--text-faint)' }}>
              <th className="text-left text-[10px] font-medium pb-1"></th>
              <th className="text-right text-[10px] font-medium pb-1">KL mua</th>
              <th className="text-right text-[10px] font-medium pb-1">Giá mua</th>
              <th className="text-left text-[10px] font-medium pb-1 pl-3">Giá bán</th>
              <th className="text-left text-[10px] font-medium pb-1">KL bán</th>
            </tr>
          </thead>
          <tbody>
            <DepthRow label="1" bidPrice={quote.bid_1_price} bidVolume={quote.bid_1_volume} askPrice={quote.ask_1_price} askVolume={quote.ask_1_volume} />
            <DepthRow label="2" bidPrice={quote.bid_2_price} bidVolume={quote.bid_2_volume} askPrice={quote.ask_2_price} askVolume={quote.ask_2_volume} />
            <DepthRow label="3" bidPrice={quote.bid_3_price} bidVolume={quote.bid_3_volume} askPrice={quote.ask_3_price} askVolume={quote.ask_3_volume} />
          </tbody>
        </table>

        <div className="mt-3">
          <div className="flex justify-between text-[11px] mb-1">
            <span style={{ color: '#10b981' }}>Dư mua {fmtNumber(bidTotal)}</span>
            <span style={{ color: '#ef4444' }}>Dư bán {fmtNumber(askTotal)}</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
            <div style={{ width: bidPct + '%', background: '#10b981' }} />
            <div style={{ width: 100 - bidPct + '%', background: '#ef4444' }} />
          </div>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-faint)' }}>
          Khớp lệnh gần nhất
        </p>
        {trades === undefined ? (
          <Loading />
        ) : trades.length === 0 ? (
          <EmptyState text="Chưa có dữ liệu khớp lệnh" />
        ) : (
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0" style={{ background: 'var(--bg-card)' }}>
                <tr style={{ color: 'var(--text-faint)' }}>
                  <th className="text-left font-medium py-1">Thời gian</th>
                  <th className="text-right font-medium py-1">Giá</th>
                  <th className="text-right font-medium py-1">KL</th>
                  <th className="text-right font-medium py-1">M/B</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="py-1" style={{ color: 'var(--text-faint)' }}>{t.time}</td>
                    <td className="py-1 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>{fmtNumber(t.price)}</td>
                    <td className="py-1 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{fmtNumber(t.volume)}</td>
                    <td className="py-1 text-right font-medium" style={{ color: t.match_type === 'Buy' ? '#10b981' : '#ef4444' }}>
                      {t.match_type === 'Buy' ? 'M' : 'B'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CompanyTabs({ symbol, quote }: { symbol: string; quote: LiveQuote | null }) {
  const [tab, setTab] = useState<TabKey>('so-lenh')

  const [overview, setOverview] = useState<StockOverview | null>()
  const [shareholders, setShareholders] = useState<Shareholder[]>()
  const [events, setEvents] = useState<CompanyEvent[]>()
  const [financials, setFinancials] = useState<FinancialStatements>()

  // Đặt lại khi đổi mã, nếu không tab sẽ hiển thị dữ liệu của mã trước đó.
  useEffect(() => {
    setOverview(undefined)
    setShareholders(undefined)
    setEvents(undefined)
    setFinancials(undefined)
  }, [symbol])

  useEffect(() => {
    if ((tab === 'ho-so' || tab === 'thong-ke' || tab === 'von-co-tuc') && overview === undefined) {
      stockDetailApi.overview(symbol).then((r) => setOverview(r.data)).catch(() => setOverview(null))
    }
    if (tab === 'co-dong' && shareholders === undefined) {
      stockDetailApi.shareholders(symbol).then((r) => setShareholders(r.data)).catch(() => setShareholders([]))
    }
    if (tab === 'su-kien' && events === undefined) {
      stockDetailApi.events(symbol).then((r) => setEvents(r.data)).catch(() => setEvents([]))
    }
    if (tab === 'tai-chinh' && financials === undefined) {
      stockDetailApi.financials(symbol).then((r) => setFinancials(r.data)).catch(() => setFinancials(undefined))
    }
  }, [tab, symbol, overview, shareholders, events, financials])

  const years = (rows: FinancialStatements['income_statement']) => {
    if (!rows || rows.length === 0) return []
    return Object.keys(rows[0]).filter((k) => /^\d{4}$/.test(k)).sort().reverse()
  }

  return (
    <div className="section-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex gap-0 overflow-x-auto mb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-3.5 py-2.5 text-[13px] whitespace-nowrap transition-colors"
            style={{
              color: tab === t.key ? '#2563eb' : 'var(--text-muted)',
              fontWeight: tab === t.key ? 600 : 400,
              borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'so-lenh' && <OrderBook symbol={symbol} quote={quote} />}

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
  )
}
