import { TrendingUp, Network, ShieldCheck } from 'lucide-react'
import BrandMark from '../common/BrandMark'
import type { ReactNode } from 'react'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
}

export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>
      {/* Brand panel */}
      <div
        className="hidden lg:flex lg:w-[46%] relative overflow-hidden flex-col justify-between p-12"
        style={{
          background: '#050c1a',
          borderRight: '1px solid #1a2d4a',
        }}
      >
        <div className="relative flex items-center gap-3">
          <div className="flex-shrink-0 rounded-md">
            <BrandMark size={44} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight gradient-text">FinNexus KG</h1>
            <p className="text-[11px] mt-0.5" style={{ color: '#3d5a7a' }}>
              VN Stock Knowledge Graph
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-2xl font-bold text-white leading-snug mb-3">
            Phân tích thị trường chứng khoán Việt Nam bằng Knowledge Graph
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: '#7d94ad' }}>
            Đọc bài báo tài chính tiếng Việt, tìm ra bài nói về mã nào và chuyện gì xảy ra,
            rồi ước lượng giá thường phản ứng thế nào sau loại tin đó.
          </p>

          {/* Mỗi dòng dưới đây phải tương ứng một tính năng có thật trong sản
              phẩm. Bản trước quảng cáo "Knowledge Graph 3D" khi route /graph,
              file GraphPage.tsx và mọi import thư viện đồ thị đều không tồn tại. */}
          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-3 text-sm" style={{ color: '#94a3b8' }}>
              <Network size={16} className="text-blue-400 flex-shrink-0" />
              Sơ đồ liên kết xem được ở 2D và 3D
            </div>
            <div className="flex items-center gap-3 text-sm" style={{ color: '#94a3b8' }}>
              <TrendingUp size={16} className="text-emerald-400 flex-shrink-0" />
              Bảng giá thị trường thời gian thực
            </div>
            <div className="flex items-center gap-3 text-sm" style={{ color: '#94a3b8' }}>
              <ShieldCheck size={16} className="text-amber-400 flex-shrink-0" />
              Nói thẳng khi không đủ chắc chắn để trả lời
            </div>
          </div>

          <p className="mt-8 text-[11px] leading-relaxed" style={{ color: '#5b7290' }}>
            Công cụ tham khảo, không phải lời khuyên mua bán. Hệ thống không đưa ra tín hiệu
            giao dịch, và im lặng khi không đủ chắc chắn.
          </p>
        </div>

        <p className="relative text-[11px]" style={{ color: '#2a3f58' }}>
          FinNexus KG · v2.0
        </p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[400px] fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="flex-shrink-0 rounded-md">
              <BrandMark size={36} />
            </div>
            <h1 className="font-bold text-[15px] gradient-text">FinNexus KG</h1>
          </div>

          <div className="section-card">
            <h2 className="text-xl font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>{title}</h2>
            <p className="text-[13px] mb-6" style={{ color: 'var(--text-secondary)' }}>
              {subtitle}
            </p>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
