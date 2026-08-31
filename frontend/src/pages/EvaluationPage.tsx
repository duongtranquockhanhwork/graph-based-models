import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { predictionApi } from '../services/api'
import type { ModelEvaluation, ModelInfo } from '../types'
import { CheckCircle2, Target, Zap, Activity, ClipboardList, AlertTriangle, Database } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const LOW_RECALL_THRESHOLD = 0.2

const CHART_TOOLTIP_STYLE = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--text-primary)',
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
      <p className="font-semibold text-[14px]" style={{ color: 'var(--text-primary)' }}>{label}</p>
      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>{desc}</p>
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
  const { user } = useAuth()
  const [data, setData] = useState<ModelEvaluation | null>(null)
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([predictionApi.evaluate(), predictionApi.modelInfo()])
      .then(([evalRes, infoRes]) => {
        setData(evalRes.data)
        setModelInfo(infoRes.data)
      })
      .finally(() => setLoading(false))
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

  if (data.insufficient_data) {
    return (
      <div className="p-6 fade-in">
        <div
          className="flex flex-col items-center justify-center py-20 rounded-2xl text-center px-6"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <ClipboardList size={32} style={{ color: 'var(--border-default)' }} className="mb-3" />
          <p className="text-[14px] font-medium" style={{ color: 'var(--text-muted)' }}>
            Chưa đủ dữ liệu để đánh giá mô hình
          </p>
          <p className="text-[12px] mt-1 max-w-md" style={{ color: 'var(--text-faint)' }}>
            Đánh giá được tính từ các tin đã có nhãn xu hướng giá thật hoặc đã gán nhãn cảm xúc thủ công (hiện có {data.sample_size}/{5} tin cần thiết).
            {user?.role === 'admin' ? (
              <> Vào <Link to="/admin/labeling" className="underline">Gán nhãn thủ công</Link> để gán thêm nhãn.</>
            ) : (
              <> Hãy liên hệ quản trị viên để gán thêm nhãn thủ công cho tin tức.</>
            )}
          </p>
        </div>
      </div>
    )
  }

  const comparisonData = [
    { name: 'Baseline\n(Text only)', accuracy: +(data.baseline_accuracy * 100).toFixed(1), fill: '#1e3a6e' },
    { name: 'Graph-enhanced\n(Text + KG)', accuracy: +(data.graph_enhanced_accuracy * 100).toFixed(1), fill: '#2563eb' },
    ...(data.ecbm_accuracy != null
      ? [{ name: 'ECBM\n(nhãn giá thật)', accuracy: +(data.ecbm_accuracy * 100).toFixed(1), fill: '#10b981' }]
      : []),
  ]
  const labels = data.labels || ['INCREASING', 'DECREASING', 'UNCHANGED']

  // ECBM's own per-class report (falls back to the heuristic's when no
  // checkpoint is trained yet) so the confusion matrix below reflects
  // whichever model /predict actually serves right now.
  const activeConfusionMatrix = data.ecbm_confusion_matrix ?? data.confusion_matrix
  const activeClassReport = data.ecbm_class_report ?? data.class_report
  const activeModelLabel = data.ecbm_confusion_matrix ? 'ECBM (nhãn giá thật)' : 'Graph-enhanced (heuristic)'
  const lowRecallClasses = labels.filter(l => {
    const recall = activeClassReport?.[l]?.recall
    return recall !== undefined && recall < LOW_RECALL_THRESHOLD
  })
  const trainingMetrics = modelInfo?.last_training_metrics

  const METRICS = [
    { label: 'Accuracy', value: data.accuracy, color: '#3b82f6', icon: Target, desc: 'Tỷ lệ dự đoán đúng' },
    { label: 'Precision', value: data.precision, color: '#10b981', icon: CheckCircle2, desc: 'Độ chính xác' },
    { label: 'Recall', value: data.recall, color: '#8b5cf6', icon: Activity, desc: 'Độ phủ' },
    { label: 'F1 Score', value: data.f1_score, color: '#f59e0b', icon: Zap, desc: 'Cân bằng Precision/Recall' },
  ]

  const referenceAccuracy = data.ecbm_accuracy ?? data.graph_enhanced_accuracy
  const deltaVsBaseline = ((referenceAccuracy - data.baseline_accuracy) * 100).toFixed(1)
  const deltaIsPositive = referenceAccuracy >= data.baseline_accuracy

  return (
    <div className="p-6 space-y-5 fade-in">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
          Đánh giá dựa trên {data.sample_size} tin đã có nhãn
          {trainingMetrics?.real_price_labels ? ` (${trainingMetrics.real_price_labels} nhãn xu hướng giá thật, ${trainingMetrics.sentiment_proxy_labels ?? 0} nhãn proxy từ sentiment)` : ' đã gán nhãn cảm xúc thủ công'}
        </p>
      </div>

      {/* Held-out validation panel: the honest generalization number from the
          last training run's own train/val split, separate from the numbers
          below (computed over the full labeled set, which can include rows
          the model was trained on). */}
      {trainingMetrics?.trained && (
        <div
          className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)' }}
        >
          <Database size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#60a5fa' }} />
          <div>
            <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              Held-out validation (lần train gần nhất, {trainingMetrics.val_size}/{trainingMetrics.sample_size} mẫu không dùng để train)
            </p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Accuracy {((trainingMetrics.val_accuracy ?? 0) * 100).toFixed(1)}% · F1-weighted {((trainingMetrics.val_f1_weighted ?? 0) * 100).toFixed(1)}% · F1-macro {((trainingMetrics.val_f1_macro ?? 0) * 100).toFixed(1)}%
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-faint)' }}>
              Đây là con số nên trích trong báo cáo thay vì các số bên dưới — bên dưới được tính trên toàn bộ dữ liệu đã gán nhãn (kể cả phần đã dùng để train), nên có thể lạc quan hơn thực tế.
            </p>
          </div>
        </div>
      )}

      {lowRecallClasses.length > 0 && (
        <div
          className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}
        >
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#f87171' }} />
          <div>
            <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              Recall thấp cho {lowRecallClasses.join(', ')}
            </p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
              {activeModelLabel} đang bỏ sót phần lớn các trường hợp thực tế thuộc nhãn này (recall &lt; {LOW_RECALL_THRESHOLD * 100}%) —
              cần nêu rõ hạn chế này trong báo cáo thay vì chỉ báo cáo accuracy tổng.
            </p>
          </div>
        </div>
      )}

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
          <h3 className="font-semibold text-[14px] mb-1" style={{ color: 'var(--text-primary)' }}>Baseline vs Graph-enhanced vs ECBM</h3>
          <p className="text-[11px] mb-4" style={{ color: 'var(--text-faint)' }}>
            {data.ecbm_accuracy != null
              ? 'ECBM được train trên nhãn xu hướng giá thật, không phải suy từ sentiment'
              : 'Graph-enhanced sử dụng thêm đặc trưng từ Knowledge Graph'}
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={comparisonData} barSize={56}>
              <XAxis
                dataKey="name"
                stroke="transparent"
                tick={{ fill: '#64748b', fontSize: 11 }}
              />
              <YAxis
                domain={[0, 60]}
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
            style={
              deltaIsPositive
                ? { background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)' }
                : { background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }
            }
          >
            {deltaIsPositive ? (
              <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
            ) : (
              <AlertTriangle size={16} className="flex-shrink-0" style={{ color: '#f87171' }} />
            )}
            <div>
              <p className="text-[13px] font-semibold" style={{ color: deltaIsPositive ? '#4ade80' : '#f87171' }}>
                {deltaIsPositive ? '+' : ''}{deltaVsBaseline}% so với baseline
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                {data.ecbm_accuracy != null
                  ? 'Nhãn xu hướng là giá thật sau 3 phiên, không phải suy từ sentiment — chênh lệch nhỏ (hoặc âm) là kết quả thật, không phải lỗi.'
                  : 'Graph features giúp mô hình hiểu quan hệ giữa các cổ phiếu'}
              </p>
            </div>
          </div>
        </div>

        {/* Confusion matrix */}
        <div
          className="rounded-2xl p-5 card-glow"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <h3 className="font-semibold text-[14px] mb-4" style={{ color: 'var(--text-primary)' }}>Confusion Matrix · {activeModelLabel}</h3>
          {activeConfusionMatrix && (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th
                      className="text-left text-[10px] font-medium pb-2 pr-3"
                      style={{ color: 'var(--text-faint)' }}
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
                  {activeConfusionMatrix.map((row, i) => (
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
                              : { color: 'var(--text-faint)' }
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
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: 'var(--text-faint)' }}>
              Precision / Recall theo nhãn · {activeModelLabel}
            </p>
            <div className="space-y-3">
              {labels.map(label => {
                const metrics = activeClassReport?.[label]
                if (!metrics) return null
                const precisionPct = Math.round((metrics.precision || 0) * 100)
                const recallPct = Math.round((metrics.recall || 0) * 100)
                const recallLow = (metrics.recall ?? 0) < LOW_RECALL_THRESHOLD
                return (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] w-24 flex-shrink-0" style={{ color: '#64748b' }}>
                        {label.slice(0, 4)} · Prec.
                      </span>
                      <div className="flex-1 conf-bar">
                        <div
                          className="conf-bar-fill"
                          style={{ width: `${precisionPct}%`, background: 'linear-gradient(90deg, #2563eb, #0ea5e9)' }}
                        />
                      </div>
                      <span className="text-[12px] font-semibold w-9 text-right" style={{ color: 'var(--text-primary)' }}>{precisionPct}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] w-24 flex-shrink-0" style={{ color: '#64748b' }}>
                        {label.slice(0, 4)} · Recall
                      </span>
                      <div className="flex-1 conf-bar">
                        <div
                          className="conf-bar-fill"
                          style={{
                            width: `${recallPct}%`,
                            background: recallLow ? 'linear-gradient(90deg, #ef4444, #f87171)' : 'linear-gradient(90deg, #10b981, #34d399)',
                          }}
                        />
                      </div>
                      <span
                        className="text-[12px] font-semibold w-9 text-right"
                        style={{ color: recallLow ? '#f87171' : 'var(--text-primary)' }}
                      >
                        {recallPct}%
                      </span>
                    </div>
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
        <h3 className="font-semibold text-[14px] mb-4" style={{ color: 'var(--text-primary)' }}>Graph Features được sử dụng</h3>
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
                <p className="text-[12px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                  {f.name}
                </p>
                <p className="text-[11px] mt-0.5 leading-tight" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
