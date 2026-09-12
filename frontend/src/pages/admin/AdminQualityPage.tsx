import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, PenLine, RefreshCw, Sliders, XCircle } from 'lucide-react'
import adminApi from '../../services/adminApi'
import { SkeletonBlock } from '../../components/Admin/AdminWidgets'

interface DataValidation {
  total_news: number
  news_symbol_rows: number
  model_ready_rows: number
  total_processed: number
  pass_count: number
  pass_pct: number
  review_count: number
  drop_count: number
  missing_values: number
  duplicates: number
  return_label_consistency: number
  checks: Record<string, boolean>
  failed_checks: string[]
  split_leakage_note: string
  overall_status: 'PASS' | 'FAIL'
}

interface LabelAgreement {
  total_labeled: number
  sentiment_labeled_count: number
  accuracy_sentiment: number | null
  event_labeled_count: number
  accuracy_event: number | null
  selection_bias_note?: string
}

/** Điều kiện cần đạt — dùng cho danh sách trạng thái từng phép kiểm tra. */
const CHECK_LABELS: Record<string, string> = {
  no_missing_values: 'Không có bản ghi thiếu thông tin',
  no_duplicates: 'Không có bản ghi trùng lặp',
  label_consistency_ok: 'Tin tốt/xấu và dự đoán khớp chiều nhau',
  enough_usable_rows: 'Đủ số bài dùng được',
}

/** Vấn đề tương ứng khi phép kiểm tra TRƯỢT.
 *
 *  Không dùng chung CHECK_LABELS cho phần tóm tắt: in "Không có bản ghi trùng
 *  lặp" ngay dưới dòng "Chưa đạt 1 phép kiểm tra" đọc như một lời khẳng định
 *  đã đạt, trong khi ý là ngược lại.
 */
const FAILURE_LABELS: Record<string, string> = {
  no_missing_values: 'có bản ghi thiếu thông tin quan trọng',
  no_duplicates: 'có bản ghi trùng lặp',
  label_consistency_ok: 'nhiều bài có tin tốt nhưng dự đoán giảm, hoặc ngược lại',
  enough_usable_rows: 'quá ít bài dùng được',
}

function Card({
  title,
  desc,
  action,
  children,
}: {
  title: string
  desc?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="section-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h3>
          {desc && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {desc}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <span className="text-[13px] font-semibold tabular-nums" style={{ color: accent || 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  )
}

/** Chất lượng dữ liệu và nhãn — gộp hai trang cũ.
 *
 * `/admin/data-validation` và `/admin/validation-results` là hai trang riêng
 * nhưng cùng đọc `validation_service`, cùng trả lời một câu hỏi ("dữ liệu và
 * nhãn có dùng được không"), và cả hai đều không dẫn tới nơi khắc phục.
 *
 * Trang này gộp chúng và nối vào hai nơi thực sự thay đổi được kết quả: hàng
 * chờ Gán nhãn (thêm nhãn) và Cấu hình phân tích (đổi ngưỡng).
 */
export default function AdminQualityPage() {
  const [validation, setValidation] = useState<DataValidation | null>(null)
  const [agreement, setAgreement] = useState<LabelAgreement | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      adminApi.validation.dataQuality().then((r) => setValidation(r.data)),
      adminApi.validation.results().then((r) => setAgreement(r.data)),
    ]).finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  return (
    <div className="p-4 sm:p-6 space-y-4 fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Chất lượng dữ liệu
          </h2>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Dữ liệu có sạch không, và máy đọc bài có giống người đọc không
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px]"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Chạy lại kiểm định
        </button>
      </div>

      {loading || !validation ? (
        <SkeletonBlock className="h-72" />
      ) : (
        <>
          {/* Kết luận tổng thể, kèm việc cần làm */}
          <div
            className="rounded-lg p-4 flex flex-wrap items-center justify-between gap-3"
            style={{
              background: validation.overall_status === 'PASS' ? 'rgba(16,185,129,0.08)' : 'rgba(217,119,6,0.08)',
              border: `1px solid ${validation.overall_status === 'PASS' ? 'rgba(16,185,129,0.25)' : 'rgba(217,119,6,0.28)'}`,
            }}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {validation.overall_status === 'PASS' ? (
                <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" style={{ color: '#0b7d5a' }} />
              ) : (
                <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" style={{ color: '#b45309' }} />
              )}
              <div>
                <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {validation.overall_status === 'PASS'
                    ? 'Dữ liệu đạt toàn bộ phép kiểm tra'
                    : `Chưa đạt ${validation.failed_checks.length} phép kiểm tra`}
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {validation.overall_status === 'PASS'
                    ? 'Mọi điều kiện đều thoả, kể cả tỉ lệ bản ghi dùng được cho mô hình.'
                    : `Vấn đề: ${validation.failed_checks.map((c) => FAILURE_LABELS[c] || c).join(' · ')}.`}
                </p>
              </div>
            </div>
            {validation.review_count > 0 && (
              <Link
                to="/admin/labeling"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[12px] font-medium text-white flex-shrink-0"
                style={{ background: '#047857' }}
              >
                <PenLine size={12} /> Xử lý {validation.review_count} tin chờ gán nhãn
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card
              title="Pipeline dữ liệu"
              desc="Bao nhiêu bài đi trọn được tới bước đưa ra nhận định"
            >
              <div className="space-y-2.5">
                <Row label="Tổng số tin" value={validation.total_news} />
                <Row label="Đã xử lý" value={validation.total_processed} />
                <Row
                  label="Dùng được"
                  value={`${validation.pass_count} (${validation.pass_pct}%)`}
                  accent={validation.pass_pct >= 50 ? '#0b7d5a' : '#c0392e'}
                />
                <Row label="Chờ gán nhãn thủ công" value={validation.review_count} accent="#b45309" />
                <Row
                  label="Bỏ qua (không tìm thấy mã nào)"
                  value={validation.drop_count}
                  accent={validation.drop_count > 0 ? '#c0392e' : undefined}
                />
                <Row label="Số lần một bài gắn với một mã" value={validation.news_symbol_rows} />
              </div>

              {validation.drop_count > 0 && (
                <p className="text-[11px] mt-3 pt-3" style={{ color: 'var(--text-faint)', borderTop: '1px dashed var(--border-subtle)' }}>
                  Bài bị bỏ qua thường vì không nhắc tới mã nào hệ thống nhận ra. Thêm từ khoá
                  hoặc tên gọi khác của công ty ở{' '}
                  <Link to="/admin/tuning" className="hover:underline" style={{ color: '#2563eb' }}>
                    Cấu hình phân tích
                  </Link>
                  .
                </p>
              )}
            </Card>

            <Card
              title="Các phép kiểm tra"
              desc="Chỉ báo ĐẠT khi tất cả mục dưới đây đều đạt"
            >
              <div className="space-y-2.5 mb-4">
                <Row label="Bản ghi thiếu thông tin" value={validation.missing_values} />
                <Row label="Bản ghi trùng lặp" value={validation.duplicates} />
                <Row label="Tin tốt/xấu và dự đoán khớp chiều nhau" value={`${validation.return_label_consistency}%`} />
              </div>

              <div className="space-y-1.5 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                {Object.entries(validation.checks).map(([key, ok]) => (
                  <div key={key} className="flex items-center gap-2">
                    {ok ? (
                      <CheckCircle2 size={12} className="flex-shrink-0" style={{ color: '#0b7d5a' }} />
                    ) : (
                      <XCircle size={12} className="flex-shrink-0" style={{ color: '#c0392e' }} />
                    )}
                    <span className="text-[11px]" style={{ color: ok ? 'var(--text-muted)' : '#c0392e' }}>
                      {CHECK_LABELS[key] || key}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-[11px] mt-3 pt-3" style={{ color: 'var(--text-faint)', borderTop: '1px dashed var(--border-subtle)' }}>
                {validation.split_leakage_note}
              </p>
            </Card>
          </div>

          {/* Độ khớp nhãn — nội dung của trang "Kết quả kiểm định" cũ */}
          <Card
            title="Máy đọc bài có giống người đọc không"
            desc="So kết quả máy tự đọc với kết quả do quản trị viên tự đọc và xác nhận"
            action={
              <Link
                to="/admin/labeling"
                className="inline-flex items-center gap-1.5 text-[12px] hover:underline"
                style={{ color: '#2563eb' }}
              >
                <PenLine size={12} /> Mở hàng chờ gán nhãn
              </Link>
            }
          >
            {!agreement || agreement.total_labeled === 0 ? (
              <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                Chưa có mẫu nào được gán nhãn thủ công. Xử lý hàng chờ ở trang{' '}
                <Link to="/admin/labeling" className="hover:underline" style={{ color: '#2563eb' }}>
                  Gán nhãn
                </Link>{' '}
                để hệ thống tính được độ khớp.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      label: 'Giống nhau về tin tốt/xấu',
                      value: agreement.accuracy_sentiment != null ? `${agreement.accuracy_sentiment}%` : '—',
                      sub: `${agreement.sentiment_labeled_count} mẫu`,
                      color: '#0b7d5a',
                    },
                    {
                      label: 'Giống nhau về loại sự việc',
                      value: agreement.accuracy_event != null ? `${agreement.accuracy_event}%` : '—',
                      sub: `${agreement.event_labeled_count} mẫu`,
                      color: '#2563eb',
                    },
                    {
                      label: 'Số bài đã xác nhận',
                      value: String(agreement.total_labeled),
                      sub: 'Quản trị viên đã đọc',
                      color: '#b45309',
                    },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="rounded-md p-3.5"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                    >
                      <p className="text-2xl font-bold tabular-nums" style={{ color: m.color }}>
                        {m.value}
                      </p>
                      <p className="text-[12px] font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                        {m.label}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                        {m.sub}
                      </p>
                    </div>
                  ))}
                </div>

                <div
                  className="mt-3 rounded-md p-3 flex items-start gap-2"
                  style={{ background: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.2)' }}
                >
                  <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#b45309' }} />
                  <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {agreement.selection_bias_note ||
                      'Chỉ đo trên các bài đã vào hàng chờ gán nhãn, không đại diện cho toàn bộ dữ liệu.'}{' '}
                    Đây <strong>không phải</strong> mức chính xác của phần dự đoán giá — con số đó
                    nằm ở trang Bằng chứng mô hình.
                  </p>
                </div>
              </>
            )}
          </Card>

          <div
            className="rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3"
            style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-subtle)' }}
          >
            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
              Muốn cải thiện các con số trên? Có hai cách: tự đọc và xác nhận thêm bài, hoặc
              chỉnh lại cách hệ thống nhận diện.
            </p>
            <div className="flex gap-2">
              <Link
                to="/admin/labeling"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px]"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                <PenLine size={12} /> Gán nhãn
              </Link>
              <Link
                to="/admin/tuning"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px]"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                <Sliders size={12} /> Cấu hình phân tích
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
