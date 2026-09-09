import { Loader2 } from 'lucide-react'
import { useAnalysisJobs } from '../../context/AnalysisJobsContext'

/** Chỉ báo "đang phân tích" trên thanh trên cùng.
 *
 * Người dùng nhập dữ liệu rồi thường đi xem trang khác ngay. Nếu không có chỗ
 * nào cho biết hệ thống vẫn đang làm việc, họ sẽ thấy trang Tin tức thiếu kết
 * quả và tưởng là hỏng. Chỉ báo này hiện ở mọi trang cho tới khi xong, rồi
 * biến mất — thông báo kèm đường dẫn kết quả do AnalysisJobsContext đưa ra.
 */
export default function AnalysisIndicator() {
  const { jobs } = useAnalysisJobs()
  const active = jobs.filter((j) => !j.done)
  if (active.length === 0) return null

  const total = active.reduce((sum, j) => sum + j.total, 0)
  const analyzed = active.reduce((sum, j) => sum + j.analyzed, 0)
  const pct = total > 0 ? Math.round((analyzed / total) * 100) : 0

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1 rounded-full"
      style={{
        background: 'rgba(37,99,235,0.10)',
        border: '1px solid rgba(37,99,235,0.22)',
      }}
      role="status"
      aria-live="polite"
      title={`Đang phân tích ${analyzed}/${total} bài báo`}
    >
      <Loader2 size={11} className="animate-spin" style={{ color: '#2563eb' }} />
      <span className="text-[11px] font-medium whitespace-nowrap" style={{ color: '#2563eb' }}>
        <span className="hidden sm:inline">Đang phân tích </span>
        {analyzed}/{total}
      </span>
      <div
        className="hidden md:block w-12 h-1 rounded-full overflow-hidden"
        style={{ background: 'rgba(37,99,235,0.18)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: '#2563eb' }}
        />
      </div>
    </div>
  )
}
