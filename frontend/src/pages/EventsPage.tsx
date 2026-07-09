import { useEffect, useMemo, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { newsApi } from '../services/api'
import type { NewsArticle } from '../types'

const EVENT_LABELS: Record<string, string> = {
  profit_growth: 'Lợi nhuận/doanh thu tăng',
  profit_decline: 'Lợi nhuận/doanh thu giảm',
  dividend: 'Chia cổ tức',
  merger: 'Sáp nhập/mua lại',
  new_contract: 'Ký hợp đồng/trúng thầu mới',
  penalty: 'Vi phạm/xử phạt',
  leadership_change: 'Thay đổi lãnh đạo',
  share_issuance: 'Phát hành cổ phiếu/tăng vốn',
  expansion: 'Mở rộng đầu tư/kinh doanh',
}

export default function EventsPage() {
  const [news, setNews] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState<string | null>(null)

  useEffect(() => {
    newsApi.list({ skip: 0, limit: 300 }).then((r) => setNews(r.data)).finally(() => setLoading(false))
  }, [])

  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const n of news) {
      for (const ev of n.events_detected || []) {
        counts[ev] = (counts[ev] || 0) + 1
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [news])

  const filteredNews = useMemo(() => {
    if (!activeType) return []
    return news.filter((n) => (n.events_detected || []).includes(activeType)).slice(0, 30)
  }, [news, activeType])

  return (
    <div className="p-6 space-y-4 fade-in">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Sự kiện tài chính</h2>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Các sự kiện được nhận diện tự động từ nội dung tin tức
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : eventCounts.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-2xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <CalendarClock size={32} style={{ color: 'var(--border-default)' }} className="mb-3" />
          <p className="text-[14px] font-medium" style={{ color: 'var(--text-muted)' }}>Chưa nhận diện được sự kiện nào</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {eventCounts.map(([type, count]) => (
              <button
                key={type}
                onClick={() => setActiveType(activeType === type ? null : type)}
                className="rounded-2xl p-4 text-left card-glow transition-all"
                style={
                  activeType === type
                    ? { background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.35)' }
                    : { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }
                }
              >
                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{count}</p>
                <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>{EVENT_LABELS[type] || type}</p>
              </button>
            ))}
          </div>

          {activeType && (
            <div className="section-card">
              <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                Tin tức: {EVENT_LABELS[activeType] || activeType}
              </h3>
              <div className="space-y-2">
                {filteredNews.map((n) => (
                  <div key={n.id} className="py-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                      {(n.stocks_mentioned || []).join(', ') || '—'} · {n.source || '—'} · {n.published_date || '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
