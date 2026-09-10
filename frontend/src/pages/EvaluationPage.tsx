import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ClipboardList, Database, Info, Target } from 'lucide-react'
import { predictionApi } from '../services/api'
import type { ModelEvaluation, ModelInfo } from '../types'

const CHART_TOOLTIP_STYLE = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--text-primary)',
}

const TREND_VI: Record<string, string> = {
  INCREASING: 'Giá tăng',
  DECREASING: 'Giá giảm',
  UNCHANGED: 'Ít đổi',
}

function MetricCard({
  label,
  value,
  desc,
  color,
  icon: Icon,
}: {
  label: string
  value: string
  desc: string
  color: string
  icon: React.ElementType
}) {
  return (
    <div
      className="rounded-lg p-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="w-9 h-9 rounded-md flex items-center justify-center"
          style={{ background: color + '18', border: `1px solid ${color}30` }}
        >
          <Icon size={16} style={{ color }} />
        </div>
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>
          {value}
        </span>
      </div>
      <p className="font-semibold text-[14px]" style={{ color: 'var(--text-primary)' }}>
        {label}
      </p>
      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
        {desc}
      </p>
    </div>
  )
}

/** Kết quả kiểm tra chính thức, lấy từ hồ sơ mô hình đã đóng băng — không phải
 *  tính lại trên dữ liệu người dùng.
 *
 *  Mỗi con số luôn đi kèm mức tham chiếu, vì một điểm số đứng một mình không
 *  cho biết hệ thống có hơn đoán bừa hay không. Và mọi thuật ngữ đều được diễn
 *  giải ngay tại chỗ: người đọc trang này là nhà đầu tư, không phải kỹ sư. */
function OfficialEvidence({ info }: { info: ModelInfo }) {
  if (!info.available || !info.performance) {
    return (
      <div
        className="rounded-lg p-5 flex items-start gap-3"
        style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.28)' }}
      >
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" style={{ color: '#b45309' }} />
        <div>
          <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            Chưa cài đặt phần dự đoán
          </p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>
            Hệ thống hiện chỉ đọc từ ngữ trong bài để đoán tin tốt hay xấu, và cách đọc đó{' '}
            <strong>chưa từng được kiểm chứng bằng diễn biến giá thật</strong>. Hãy xem kết quả như
            một gợi ý, đừng dựa vào nó để ra quyết định.
          </p>
        </div>
      </div>
    )
  }

  const p = info.performance
  const chart = [
    { name: 'Cách đơn giản', value: +(p.baseline_macro_f1 * 100).toFixed(1), fill: '#94a3b8' },
    { name: 'Hệ thống này', value: +(p.out_of_fold_macro_f1 * 100).toFixed(1), fill: '#2563eb' },
  ]

  return (
    <div
      className="rounded-lg p-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            Hệ thống đoán đúng đến đâu
          </h3>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Kết quả kiểm tra trên hàng nghìn bài báo cũ đã biết giá chạy thế nào sau đó — không phải
            trên dữ liệu bạn vừa nhập
          </p>
        </div>
        {/* Mã phiên bản (ví dụ FINNEXUS_V56_DEPLOYABLE_MODEL_V1) là mã tra cứu
            trong hồ sơ nghiên cứu, không có nghĩa gì với người đọc thường. Hiện
            câu chữ dễ hiểu, giữ mã trong tooltip để vẫn truy vết được. */}
        <span
          className="text-[10px] font-semibold px-2 py-1 rounded"
          style={{ background: 'rgba(37,99,235,0.12)', color: '#2563eb' }}
          title={`Mã phiên bản mô hình: ${info.version}`}
        >
          Bản đã kiểm định
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={chart} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={0} />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              domain={[0, 60]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [`${v} điểm`, '']} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {chart.map((c) => (
                <Cell key={c.name} fill={c.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="space-y-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          <div className="flex justify-between">
            <span>Điểm của hệ thống này</span>
            <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {(p.out_of_fold_macro_f1 * 100).toFixed(1)}
            </strong>
          </div>
          <div className="flex justify-between">
            <span>Điểm khi chỉ nhìn biến động giá gần nhất</span>
            <strong className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {(p.baseline_macro_f1 * 100).toFixed(1)}
            </strong>
          </div>
          <div
            className="flex justify-between pt-2"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            <span>Hệ thống tốt hơn</span>
            <strong className="tabular-nums" style={{ color: '#0b7d5a' }}>
              +{(p.delta_vs_baseline * 100).toFixed(1)} điểm
            </strong>
          </div>

          <div
            className="rounded-md p-2.5 mt-1"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <strong>Đọc con số này thế nào.</strong> Thang điểm chấm khả năng nhận ra cả ba tình
              huống: giá tăng, giá giảm, và giá ít đổi. Hệ thống hơn cách làm đơn giản{' '}
              {(p.delta_vs_baseline * 100).toFixed(1)} điểm — chênh lệch không lớn, nhưng đã được
              kiểm tra lại nhiều lần trên dữ liệu chưa từng dùng để xây dựng nó.
            </p>
            <p className="text-[11px] leading-relaxed mt-1.5" style={{ color: 'var(--text-secondary)' }}>
              Điểm mạnh của hệ thống là nhận ra các trường hợp giá <strong>biến động mạnh</strong>.
              Nếu chỉ đếm xem đoán đúng bao nhiêu phần trăm, đoán bừa “giá ít đổi” cho mọi bài còn
              cho tỉ lệ cao hơn — vì phần lớn tin không làm giá đổi nhiều.
            </p>
          </div>

          {info.operating_point && (
            <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
              Hệ thống chỉ trả lời khoảng{' '}
              {Math.round(info.operating_point.coverage_on_development * 100)}% số bài — những bài
              còn lại nó thấy không đủ chắc chắn nên im lặng thay vì đoán bừa.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function EvaluationPage() {
  const [data, setData] = useState<ModelEvaluation | null>(null)
  const [info, setInfo] = useState<ModelInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([predictionApi.evaluate(), predictionApi.modelInfo()])
      .then(([evalRes, infoRes]) => {
        setData(evalRes.data)
        setInfo(infoRes.data)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <div className="skeleton h-48 rounded-lg" />
        <div className="skeleton h-64 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 fade-in">
      {info && <OfficialEvidence info={info} />}

      {/* Phần dưới: đo lại trên chính dữ liệu của hệ thống này. Tách bạch với
          bằng chứng chính thức ở trên, vì đây là hậu kiểm không tiền đăng ký. */}
      <div>
        <h3 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          Kiểm tra trên dữ liệu của bạn
        </h3>
        <p className="text-[12px] mb-3" style={{ color: 'var(--text-muted)' }}>
          Đối chiếu nhận định đã đưa ra với diễn biến giá thật sau ngày đăng bài
        </p>

        {!data || data.insufficient_data ? (
          <div
            className="flex flex-col items-center justify-center py-14 px-6 rounded-lg text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <Database size={28} style={{ color: 'var(--text-faint)' }} />
            <p className="mt-3 text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>
              Chưa đủ dữ liệu để kiểm tra
            </p>
            <p className="text-[12px] mt-1.5 max-w-lg" style={{ color: 'var(--text-muted)' }}>
              {data?.message ||
                'Cần thêm bài báo đã biết giá chạy thế nào sau đó để đối chiếu.'}
            </p>
            <Link
              to="/import"
              className="mt-4 px-4 py-2 rounded-md text-[13px] font-medium text-white"
              style={{ background: '#1d4ed8' }}
            >
              Nhập thêm dữ liệu
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <MetricCard
                label="Tỉ lệ đoán đúng"
                value={`${((data.accuracy || 0) * 100).toFixed(1)}%`}
                desc={`Nếu đoán bừa: ${((data.baseline?.accuracy || 0) * 100).toFixed(1)}%`}
                color={data.beats_majority ? '#0b7d5a' : '#b45309'}
                icon={Target}
              />
              <MetricCard
                label="Điểm tổng hợp"
                value={`${((data.macro_f1 || 0) * 100).toFixed(1)}%`}
                desc={`Nếu đoán bừa: ${((data.baseline?.macro_f1 || 0) * 100).toFixed(1)}%`}
                color="#2563eb"
                icon={ClipboardList}
              />
              <MetricCard
                label="So với đoán bừa"
                value={`${(data.delta_accuracy_vs_majority || 0) >= 0 ? '+' : ''}${(
                  (data.delta_accuracy_vs_majority || 0) * 100
                ).toFixed(1)}đ`}
                desc={data.beats_majority ? 'Tốt hơn đoán bừa' : 'Chưa tốt hơn đoán bừa'}
                color={data.beats_majority ? '#0b7d5a' : '#c0392e'}
                icon={Info}
              />
              <MetricCard
                label="Số bài đối chiếu"
                value={String(data.sample_size)}
                desc="Bài đã biết giá chạy thế nào"
                color="#64748b"
                icon={Database}
              />
            </div>

            {data.confusion_matrix && (
              <div
                className="rounded-lg p-5"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
              >
                <h4 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                  Đoán đúng và đoán sai ở đâu
                </h4>
                <div className="overflow-x-auto">
                  <table className="text-[12px]" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th className="p-2 text-left" style={{ color: 'var(--text-faint)' }}>
                          Giá thực tế \ Hệ thống đoán
                        </th>
                        {data.labels.map((l) => (
                          <th key={l} className="p-2 text-center" style={{ color: 'var(--text-muted)' }}>
                            {TREND_VI[l] || l}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.confusion_matrix.map((row, i) => (
                        <tr key={data.labels[i]}>
                          <td className="p-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
                            {TREND_VI[data.labels[i]] || data.labels[i]}
                          </td>
                          {row.map((cell, j) => (
                            <td
                              key={j}
                              className="p-2 text-center tabular-nums font-semibold rounded"
                              style={{
                                color: i === j ? '#0b7d5a' : 'var(--text-muted)',
                                background:
                                  i === j ? 'rgba(16,185,129,0.10)' : 'transparent',
                              }}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {data.caveat && (
              <div
                className="rounded-lg p-4 flex items-start gap-3"
                style={{ background: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.2)' }}
              >
                <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" style={{ color: '#b45309' }} />
                <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  Đây là số đo trên dữ liệu của riêng bạn, không phải kết quả thí nghiệm chính
                  thức. Đúng/sai được đối chiếu với <strong>diễn biến giá thật</strong> sau ngày
                  đăng bài — không dùng nhãn do người gán tay, vì như vậy là lấy đáp án của hệ thống
                  ra chấm cho chính hệ thống.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
