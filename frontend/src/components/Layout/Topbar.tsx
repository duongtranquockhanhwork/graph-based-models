import { useLocation } from 'react-router-dom'
import { Activity, CalendarDays } from 'lucide-react'

const PAGE_INFO: Record<string, { title: string; breadcrumb: string }> = {
  '/dashboard': { title: 'Tổng quan thị trường', breadcrumb: 'Dashboard' },
  '/import': { title: 'Nhập dữ liệu tin tức', breadcrumb: 'Import · CSV / URL / Thủ công' },
  '/analysis': { title: 'Phân tích NLP', breadcrumb: 'Xử lý ngôn ngữ tự nhiên' },
  '/graph': { title: 'Knowledge Graph 3D', breadcrumb: 'Mạng lưới tri thức trực quan' },
  '/prediction': { title: 'Dự đoán xu hướng', breadcrumb: 'Graph-enhanced Machine Learning' },
  '/evaluation': { title: 'Đánh giá mô hình', breadcrumb: 'Metrics · Baseline so sánh' },
}

export default function Topbar() {
  const { pathname } = useLocation()
  const info = PAGE_INFO[pathname] || { title: 'FinNexus KG', breadcrumb: '' }

  const now = new Date()
  const dateStr = now.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return (
    <header
      className="flex items-center justify-between px-6 h-[52px] flex-shrink-0"
      style={{
        background: 'rgba(7, 17, 31, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #1a2d4a',
      }}
    >
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-white font-semibold text-[14px] leading-tight">{info.title}</h2>
          <p className="text-[11px] leading-tight mt-0.5" style={{ color: '#3d5a7a' }}>
            {info.breadcrumb}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5" style={{ color: '#3d5a7a' }}>
          <CalendarDays size={12} />
          <span className="text-[11px]">{dateStr}</span>
        </div>

        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
          }}
        >
          <Activity size={11} className="text-green-400 pulse-dot" />
          <span className="text-[11px] text-green-400 font-medium">Live</span>
        </div>
      </div>
    </header>
  )
}
