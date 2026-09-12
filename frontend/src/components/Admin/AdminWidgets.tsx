import type { ReactNode } from 'react'

export function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  sub,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  accent: string
  sub?: string
}) {
  return (
    <div
      className="section-card card-glow flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div
        className="w-10 h-10 sm:w-12 sm:h-12 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: accent + '22', border: `1px solid ${accent}33` }}
      >
        <Icon size={20} style={{ color: accent }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide font-medium mb-0.5 leading-tight" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
        <p className="text-2xl font-bold leading-tight break-words" style={{ color: 'var(--text-primary)' }}>{value}</p>
        {sub && <p className="text-[11px] mt-1 truncate" style={{ color: 'var(--text-faint)' }}>{sub}</p>}
      </div>
    </div>
  )
}

export function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div
      className="rounded-lg p-5 card-glow"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[13px]" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

export function SkeletonBlock({ className = 'h-20' }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />
}

const SENTIMENT_BADGE: Record<string, string> = {
  Positive: 'badge-up',
  Negative: 'badge-down',
  Neutral: 'badge-neutral',
}

export function SentimentBadge({ sentiment }: { sentiment?: string | null }) {
  if (!sentiment) return <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>—</span>
  return <span className={`px-2 py-0.5 rounded-full text-[11px] ${SENTIMENT_BADGE[sentiment] || 'badge-neutral'}`}>{sentiment}</span>
}

export function StatusBadge({ status }: { status: string }) {
  const cls = status === 'PASS' || status === 'success' ? 'badge-up' : status === 'FAIL' || status === 'error' ? 'badge-down' : 'badge-neutral'
  return <span className={`px-2 py-0.5 rounded-full text-[11px] ${cls}`}>{status}</span>
}

export const CHART_TOOLTIP_STYLE = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--text-primary)',
}
