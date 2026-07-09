import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import adminApi from '../../services/adminApi'
import { SectionCard, SkeletonBlock, StatusBadge } from '../../components/Admin/AdminWidgets'

interface DataValidation {
  total_news: number
  news_symbol_rows: number
  model_ready_rows: number
  total_processed: number
  pass_count: number
  pass_pct: number
  review_count: number
  drop_count: number
  missing_values: number
  duplicates: number
  return_label_consistency: number
  split_leakage: number
  overall_status: 'PASS' | 'FAIL'
}

export default function AdminDataValidationPage() {
  const [data, setData] = useState<DataValidation | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    adminApi.validation.dataQuality().then((r) => setData(r.data)).finally(() => setLoading(false))
  }

  useEffect(load, [])

  return (
    <div className="p-6 space-y-4 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Kiểm định dữ liệu</h2>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Kiểm tra chất lượng dữ liệu pipeline tính trực tiếp từ dữ liệu tin tức thực tế
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: '#cbd5e1' }}>
          <RefreshCw size={14} /> Chạy lại kiểm định
        </button>
      </div>

      {loading || !data ? (
        <SkeletonBlock className="h-72" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SectionCard title="Thống kê pipeline dữ liệu">
            <div className="space-y-3">
              <Row label="Tổng số tin" value={data.total_news} />
              <Row label="Dòng dữ liệu news-symbol" value={data.news_symbol_rows} />
              <Row label="Dòng model-ready" value={data.model_ready_rows} />
              <Row label="Dòng PASS" value={`${data.pass_count} (${data.pass_pct}%)`} accent="#10b981" />
              <Row label="Dòng REVIEW (chờ gán nhãn)" value={data.review_count} accent="#fbbf24" />
              <Row label="Dòng DROP (không nhận diện được mã CP)" value={data.drop_count} accent="#ef4444" />
            </div>
          </SectionCard>

          <SectionCard title="Chất lượng dữ liệu" action={<StatusBadge status={data.overall_status} />}>
            <div className="space-y-3">
              <Row label="Missing values (các cột quan trọng)" value={data.missing_values} />
              <Row label="Return-Label Consistency" value={`${data.return_label_consistency}%`} />
              <Row label="News_id leakage giữa các split" value={data.split_leakage} />
              <Row label="Trùng lặp (title + mã cổ phiếu)" value={data.duplicates} />
            </div>
            <p className="text-[11px] mt-4" style={{ color: 'var(--text-faint)' }}>
              * Return-Label Consistency đo mức độ nhất quán chiều hướng giữa sentiment và xu hướng dự đoán (Positive không đi kèm DECREASING, Negative không đi kèm INCREASING). Split leakage luôn bằng 0 vì hệ thống chưa lưu tập train/test riêng.
            </p>
          </SectionCard>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-[14px] font-semibold" style={{ color: accent || '#ffffff' }}>{value}</span>
    </div>
  )
}
