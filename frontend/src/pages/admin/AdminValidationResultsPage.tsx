import { useEffect, useState } from 'react'
import adminApi from '../../services/adminApi'
import type { ValidationResult } from '../../types'
import { SectionCard, SkeletonBlock, StatCard } from '../../components/Admin/AdminWidgets'
import { Target, Tags } from 'lucide-react'

export default function AdminValidationResultsPage() {
  const [data, setData] = useState<ValidationResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.validation.results().then((r) => setData(r.data)).finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 space-y-4 fade-in">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Kết quả kiểm định</h2>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          So sánh nhãn tự động (NLP) với nhãn đã được xác nhận thủ công ở trang Gán nhãn thủ công
        </p>
      </div>

      {loading || !data ? (
        <SkeletonBlock className="h-56" />
      ) : data.total_labeled === 0 ? (
        <div className="section-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            Chưa có mẫu nào được gán nhãn thủ công. Hãy xử lý hàng chờ ở trang <strong style={{ color: 'var(--text-primary)' }}>Gán nhãn thủ công</strong> để hệ thống tính được độ chính xác.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon={Tags}
              label="Accuracy (Sentiment)"
              value={data.accuracy_sentiment != null ? `${data.accuracy_sentiment}%` : '—'}
              accent="#10b981"
              sub={`${data.sentiment_labeled_count} mẫu đã gán nhãn`}
            />
            <StatCard
              icon={Target}
              label="Accuracy (Event)"
              value={data.accuracy_event != null ? `${data.accuracy_event}%` : '—'}
              accent="#14b8a6"
              sub={`${data.event_labeled_count} mẫu đã gán nhãn`}
            />
            <StatCard icon={Tags} label="Tổng mẫu đã gán nhãn" value={data.total_labeled} accent="#f59e0b" />
          </div>

          <SectionCard title="Diễn giải">
            <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              Accuracy (Sentiment) = tỉ lệ tin mà sentiment tự động (NLP) trùng khớp với sentiment do admin xác nhận thủ công.
              Accuracy (Event) = tỉ lệ tin mà sự kiện do admin xác nhận nằm trong danh sách sự kiện hệ thống đã tự nhận diện được.
            </p>
          </SectionCard>
        </>
      )}
    </div>
  )
}
