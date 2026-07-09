import { useEffect, useState } from 'react'
import adminApi from '../../services/adminApi'
import type { StockAggregation } from '../../types'
import { SkeletonBlock } from '../../components/Admin/AdminWidgets'

export default function AdminStocksPage() {
  const [stocks, setStocks] = useState<StockAggregation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.stocks.list().then((r) => setStocks(r.data)).finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 space-y-4 fade-in">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Quản lý cổ phiếu</h2>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Danh mục {stocks.length || 25} mã cổ phiếu theo dõi (nguồn: stock_dictionary.json) cùng số lần được nhắc đến trong tin tức thực tế
        </p>
      </div>

      {loading ? (
        <SkeletonBlock className="h-64" />
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ color: 'var(--text-faint)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Mã CP', 'Công ty', 'Ngành', 'Số lần nhắc đến', 'Tích cực', 'Trung lập', 'Tiêu cực'].map((h) => (
                    <th key={h} className="text-left font-medium px-3 py-2.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stocks.map((s) => (
                  <tr key={s.symbol} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="px-3 py-2.5 font-semibold" style={{ color: 'var(--text-primary)' }}>{s.symbol}</td>
                    <td className="px-3 py-2.5" style={{ color: 'var(--text-secondary)' }}>{s.company || '—'}</td>
                    <td className="px-3 py-2.5" style={{ color: 'var(--text-secondary)' }}>{s.industry || '—'}</td>
                    <td className="px-3 py-2.5 font-medium" style={{ color: '#2dd4bf' }}>{s.mention_count}</td>
                    <td className="px-3 py-2.5" style={{ color: '#10b981' }}>{s.sentiment_distribution.Positive || 0}</td>
                    <td className="px-3 py-2.5" style={{ color: 'var(--text-secondary)' }}>{s.sentiment_distribution.Neutral || 0}</td>
                    <td className="px-3 py-2.5" style={{ color: '#ef4444' }}>{s.sentiment_distribution.Negative || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
