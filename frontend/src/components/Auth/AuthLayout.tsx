import { Link } from 'react-router-dom'
import { TrendingUp, Network, ShieldCheck } from 'lucide-react'
import BrandMark from '../common/BrandMark'
import type { ReactNode } from 'react'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
  // Nút chuyển đổi Đăng nhập/Đăng ký hiện trong khối màu bên trái (giống mẫu
  // tham khảo) — chỉ hiện ở màn hình lg+; bản mobile dùng link thường ở cuối
  // form (mỗi trang tự đặt link đó bên trong children).
  footerAction?: { question: string; linkText: string; to: string }
}

// Panel bên phải cố định một tông tối riêng (không đi theo biến --bg-* vốn
// đổi theo light/dark toggle) — trang đăng nhập/đăng ký luôn tối, đồng bộ với
// giao diện dashboard, thay vì chuyển sang nền trắng khi người dùng đang ở
// chế độ sáng.
const PANEL_RIGHT_BG = '#0a1628'

export default function AuthLayout({ title, subtitle, children, footerAction }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex auth-shell" style={{ background: PANEL_RIGHT_BG }}>
      {/* Brand panel — mép phải bo cong lớn kiểu "giọt nước" lồi sang panel
          form, thay cho đường viền thẳng (theo mẫu tham khảo người dùng gửi). */}
      <div
        className="hidden lg:flex lg:w-[44%] relative overflow-hidden flex-col justify-between p-12"
        style={{
          background: 'linear-gradient(160deg, #07111f 0%, #050c1a 60%, #0a1628 100%)',
          borderRadius: '0 30% 30% 0 / 0 50% 50% 0',
        }}
      >
        <div
          className="absolute w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(37,99,235,0.25) 0%, transparent 70%)',
            top: '-120px',
            left: '-120px',
          }}
        />
        <div
          className="absolute w-[360px] h-[360px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(14,165,233,0.18) 0%, transparent 70%)',
            bottom: '-100px',
            right: '-80px',
          }}
        />

        <div className="relative flex items-center gap-3">
          <div
            className="flex-shrink-0 rounded-xl"
            style={{ boxShadow: '0 0 24px rgba(37,99,235,0.45), 0 2px 8px rgba(0,0,0,0.4)' }}
          >
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

          {footerAction && (
            <div className="mt-8 flex items-center gap-3">
              <span className="text-sm" style={{ color: '#94a3b8' }}>
                {footerAction.question}
              </span>
              <Link
                to={footerAction.to}
                className="px-5 py-2 rounded-full text-[13px] font-semibold text-white transition-colors"
                style={{ border: '1.5px solid rgba(255,255,255,0.5)' }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLAnchorElement).style.borderColor = '#fff'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.5)'
                }}
              >
                {footerAction.linkText}
              </Link>
            </div>
          )}
        </div>

        <p className="relative text-[11px]" style={{ color: '#2a3f58' }}>
          FinNexus KG · v2.0
        </p>
      </div>

      {/* Form panel — luôn tối, không đổi theo light/dark toggle */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10" style={{ background: PANEL_RIGHT_BG }}>
        <div className="w-full max-w-[400px] fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div
              className="flex-shrink-0 rounded-xl"
              style={{ boxShadow: '0 0 20px rgba(37,99,235,0.45)' }}
            >
              <BrandMark size={36} />
            </div>
            <h1 className="font-bold text-[15px] gradient-text">FinNexus KG</h1>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-2" style={{ color: '#3d82f6' }}>
            Chào mừng
          </p>
          <h2 className="text-2xl font-bold mb-1.5 text-white">{title}</h2>
          <p className="text-[13px] mb-7" style={{ color: '#7d94ad' }}>
            {subtitle}
          </p>
          {children}
        </div>
      </div>
    </div>
  )
}
