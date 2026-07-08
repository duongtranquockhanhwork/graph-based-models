import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { predictionApi } from '../services/api'
import type { ModelEvaluation } from '../types'
import { CheckCircle2, Target, Zap, Activity } from 'lucide-react'

const CHART_TOOLTIP_STYLE = {
  background: '#0d1f35',
  border: '1px solid #1e3556',
  borderRadius: 10,
  fontSize: 12,
  color: '#e2e8f0',
}

function MetricCard({
  label,
  value,
  color,
  icon: Icon,
  desc,
}: {
  label: string
  value: number
  color: string
  icon: React.ElementType
  desc: string
}) {
  const pct = Math.round(value * 100 * 10) / 10
  return (
    <div
      className="rounded-2xl p-5 card-glow"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: color + '18', border: `1px solid ${color}30` }}
        >
          <Icon size={16} style={{ color }} />
        </div>
        <span
          className="text-3xl font-bold"
          style={{ color }}
        >
          {pct}%
        </span>
      </div>
      <p className="text-white font-semibold text-[14px]">{label}</p>
      <p className="text-[11px] mt-0.5" style={{ color: '#3d5a7a' }}>{desc}</p>
      <div className="conf-bar mt-3">
        <div
          className="conf-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

export default function EvaluationPage() {
  const [data, setData] = useState<ModelEvaluation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    predictionApi.evaluate().then(r => setData(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6 space-y-5">
        <div className="skeleton h-7 w-52 rounded-lg" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-64 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-400 text-sm">Không thể tải dữ liệu đánh giá</p>
      </div>
    )
  }

  const comparisonData = [
    { name: 'Baseline\n(Text only)', accuracy: +(data.baseline_accuracy * 100).toFixed(1), fill: '#1e3a6e' },
    { name: 'Graph-enhanced\n(Text + KG)', accuracy: +(data.graph_enhanced_accuracy * 100).toFixed(1), fill: '#2563eb' },
  ]
  const labels = data.labels || ['INCREASING', 'DECREASING', 'UNCHANGED']
  const improvement = ((data.graph_enhanced_accuracy - data.baseline_accuracy) * 100).toFixed(1)

  const METRICS = [
    { label: 'Accuracy', value: data.accuracy, color: '#3b82f6', icon: Target, desc: 'Tỷ lệ dự đoán đúng' },
    { label: 'Precision', value: data.precision, color: '#10b981', icon: CheckCircle2, desc: 'Độ chính xác' },
    { label: 'Recall', value: data.recall, color: '#8b5cf6', icon: Activity, desc: 'Độ phủ' },
    { label: 'F1 Score', value: data.f1_score, color: '#f59e0b', icon: Zap, desc: 'Cân bằng Precision/Recall' },
  ]

  return (
    <div className="p-6 space-y-5 fade-in">
      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {METRICS.map(m => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Comparison chart */}
        <div
          className="rounded-2xl p-5 card-glow"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <h3 className="text-white font-semibold text-[14px] mb-1">Baseline vs Graph-enhanced</h3>
          <p className="text-[11px] mb-4" style={{ color: '#3d5a7a' }}>
            Graph-enhanced sử dụng thêm đặc trưng từ Knowledge Graph
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={comparisonData} barSize={56}>
              <XAxis
                dataKey="name"
                stroke="transparent"
                tick={{ fill: '#64748b', fontSize: 11 }}
              />
              <YAxis
                domain={[50, 90]}
                stroke="transparent"
                tick={{ fill: '#64748b', fontSize: 11 }}
                unit="%"
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                cursor={{ fill: 'rgba(37,99,235,0.05)' }}
                formatter={(v: number) => [`${v}%`, 'Accuracy']}
              />
              <Bar dataKey="accuracy" radius={[8, 8, 0, 0]}>
                {comparisonData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div
            className="mt-3 flex items-center gap-3 p-3 rounded-xl"
            style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)' }}
          >
            <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
            <div>
              <p className="text-green-400 text-[13px] font-semibold">
                +{improvement}% cải thiện accuracy
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: '#3d5a7a' }}>
                Graph features giúp mô hình hiểu quan hệ giữa các cổ phiếu
              </p>
            </div>
          </div>
        </div>

        {/* Confusion matrix */}
        <div
          className="rounded-2xl p-5 card-glow"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <h3 className="text-white font-semibold text-[14px] mb-4">Confusion Matrix · Graph-enhanced</h3>
          {data.confusion_matrix && (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th
                      className="text-left text-[10px] font-medium pb-2 pr-3"
                      style={{ color: '#3d5a7a' }}
                    >
                      Thực tế ╲ Dự đoán
                    </th>
                    {labels.map(l => (
                      <th
                        key={l}
                        className="text-center text-[10px] font-semibold pb-2 px-2"
                        style={{ color: '#60a5fa' }}
                      >
                        {l.slice(0, 4)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.confusion_matrix.map((row, i) => (
                    <tr key={i}>
                      <td
                        className="text-[11px] font-medium pr-3 py-2"
                        style={{ color: '#10b981' }}
                      >
                        {labels[i]?.slice(0, 4)}
                      </td>
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className="text-center py-2 px-2 rounded-lg text-[13px] font-bold"
                          style={
                            i === j
                              ? { background: 'rgba(37,99,235,0.2)', color: '#93c5fd' }
                              : { color: '#334155' }
                          }
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: '#3d5a7a' }}>
              Precision theo nhãn
            </p>
            <div className="space-y-2.5">
              {labels.map(label => {
                const report = data.class_report as Record<string, Record<string, number>>
                const metrics = report?.[label]
                if (!metrics) return null
                const pct = Math.round((metrics.precision || 0) * 100)
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-[11px] w-20 flex-shrink-0" style={{ color: '#64748b' }}>
                      {label.slice(0, 4)}
                    </span>
                    <div className="flex-1 conf-bar">
                      <div
                        className="conf-bar-fill"
                        style={{
                          width: `${pct}%`,
                          background: 'linear-gradient(90deg, #2563eb, #0ea5e9)',
                        }}
                      />
                    </div>
                    <span className="text-[12px] font-semibold w-9 text-right text-white">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Graph features */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <h3 className="text-white font-semibold text-[14px] mb-4">Graph Features được sử dụng</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { name: 'Degree Centrality', desc: 'Số kết nối của cổ phiếu trong graph', color: '#3b82f6' },
            { name: 'Betweenness Centrality', desc: 'Vai trò trung gian trong mạng lưới', color: '#8b5cf6' },
            { name: 'Mention Frequency', desc: 'Số lần được nhắc đến trong tin tức', color: '#0ea5e9' },
            { name: 'Positive News Count', desc: 'Số tin tích cực gần đây', color: '#10b981' },
            { name: 'Negative News Count', desc: 'Số tin tiêu cực gần đây', color: '#ef4444' },
            { name: 'Sentiment Ratio', desc: 'Tỷ lệ tin tích cực / tổng tin', color: '#f59e0b' },
          ].map(f => (
            <div
              key={f.name}
              className="flex items-start gap-3 p-3 rounded-xl card-glow"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              <div
                className="w-1.5 h-full min-h-8 rounded-full flex-shrink-0 mt-0.5"
                style={{ background: f.color, boxShadow: `0 0 8px ${f.color}50` }}
              />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold leading-tight" style={{ color: '#e2e8f0' }}>
                  {f.name}
                </p>
                <p className="text-[11px] mt-0.5 leading-tight" style={{ color: '#475569' }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
