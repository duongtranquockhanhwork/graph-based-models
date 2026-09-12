import { Link } from 'react-router-dom'
import BrandMark from '../common/BrandMark'
import type { ReactNode } from 'react'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
  // Nút "quay lại đăng nhập" hiện trong khối màu bên trái ở màn hình lg+;
  // bản mobile dùng link thường ở cuối form (mỗi trang tự đặt link đó bên
  // trong children).
  footerAction?: { question: string; linkText: string; to: string }
}

// Cùng tông nền tối với AuthPage.tsx (đăng nhập/đăng ký) — trang quên mật
// khẩu/đặt lại mật khẩu/hoàn tất hồ sơ phải trông như CÙNG một bộ giao diện,
// không phải một thiết kế khác còn sót lại từ trước khi tối giản hoá.
const PANEL_BG = '#0a1628'

export default function AuthLayout({ title, subtitle, children, footerAction }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center auth-shell p-4 sm:p-8" style={{ background: PANEL_BG }}>
      {/* Desktop: khối bo cong lớn giống hệt AuthPage, chỉ khác là đứng yên
          (không có gì để trượt qua lại trên các trang một-bước này). */}
      <div className="hidden lg:block relative w-full max-w-5xl" style={{ height: '660px' }}>
        <div className="absolute inset-0 rounded-[28px] overflow-hidden" style={{ boxShadow: '0 25px 70px rgba(0,0,0,0.55)' }}>
          <div
            className="absolute top-0 left-0 h-full w-[44%] flex flex-col justify-between p-12"
            style={{
              background: 'linear-gradient(160deg, #07111f 0%, #050c1a 60%, #0a1628 100%)',
              borderRadius: '0 30% 30% 0 / 0 50% 50% 0',
            }}
          >
            <div className="relative flex items-center gap-3">
              <div
                className="flex-shrink-0 rounded-xl"
                style={{ boxShadow: '0 0 24px rgba(37,99,235,0.45), 0 2px 8px rgba(0,0,0,0.4)' }}
              >
                <BrandMark size={40} />
              </div>
              <h1 className="font-bold text-base leading-tight gradient-text">FinNexus KG</h1>
            </div>

            <div className="relative">
              <h2 className="text-3xl font-bold text-white leading-snug mb-8">{title}</h2>

              {footerAction && (
                <div className="flex items-center gap-3">
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

            <div />
          </div>

          <div
            className="absolute top-0 right-0 h-full w-[56%] flex items-center justify-center p-10"
            style={{ background: PANEL_BG }}
          >
            <div className="w-full max-w-[380px]">
              <h2 className="text-2xl font-bold mb-1.5 text-white">{title}</h2>
              <p className="text-[13px] mb-6" style={{ color: 'var(--text-secondary)' }}>
                {subtitle}
              </p>
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: xếp dọc, không có khối bo cong (không đủ chỗ). */}
      <div className="lg:hidden w-full max-w-[400px] fade-in">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="flex-shrink-0 rounded-xl" style={{ boxShadow: '0 0 20px rgba(37,99,235,0.45)' }}>
            <BrandMark size={36} />
          </div>
          <h1 className="font-bold text-[15px] gradient-text">FinNexus KG</h1>
        </div>
        <h2 className="text-2xl font-bold mb-1.5 text-white">{title}</h2>
        <p className="text-[13px] mb-6" style={{ color: 'var(--text-secondary)' }}>
          {subtitle}
        </p>
        {children}
      </div>
    </div>
  )
}
