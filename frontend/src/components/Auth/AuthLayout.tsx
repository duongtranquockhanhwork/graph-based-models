import { GitBranch, TrendingUp, Network } from 'lucide-react'
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
          background: 'linear-gradient(160deg, #07111f 0%, #050c1a 60%, #0a1628 100%)',
          borderRight: '1px solid #1a2d4a',
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
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%)',
              boxShadow: '0 0 24px rgba(37,99,235,0.45), 0 2px 8px rgba(0,0,0,0.4)',
            }}
          >
            <GitBranch size={20} className="text-white" />
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
            Kết hợp NLP, đồ thị tri thức và machine learning để dự đoán xu hướng cổ phiếu từ tin
            tức tài chính.
          </p>

          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-3 text-sm" style={{ color: '#94a3b8' }}>
              <Network size={16} className="text-blue-400 flex-shrink-0" />
              Knowledge Graph 3D trực quan
            </div>
            <div className="flex items-center gap-3 text-sm" style={{ color: '#94a3b8' }}>
              <TrendingUp size={16} className="text-emerald-400 flex-shrink-0" />
              Dự đoán xu hướng theo thời gian thực
            </div>
          </div>
        </div>

        <p className="relative text-[11px]" style={{ color: '#2a3f58' }}>
          Graph-based Models · v1.0
        </p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[400px] fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%)',
                boxShadow: '0 0 20px rgba(37,99,235,0.45)',
              }}
            >
              <GitBranch size={17} className="text-white" />
            </div>
            <h1 className="font-bold text-[15px] gradient-text">FinNexus KG</h1>
          </div>

          <div className="section-card">
            <h2 className="text-xl font-bold text-white mb-1.5">{title}</h2>
            <p className="text-[13px] mb-6" style={{ color: '#7d94ad' }}>
              {subtitle}
            </p>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
