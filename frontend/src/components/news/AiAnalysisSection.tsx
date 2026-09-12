import { useEffect, useState } from 'react'
import axios from 'axios'
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react'
import { newsApi } from '../../services/api'
import type { AiAnalysis } from '../../types'

// Trạng thái cấu hình dùng chung cho mọi thẻ trên trang — hỏi một lần thôi.
let configuredCache: Promise<{ configured: boolean; model: string } | null> | null = null

function useAiConfigured() {
  const [state, setState] = useState<{ configured: boolean; model: string } | null>(null)
  useEffect(() => {
    if (!configuredCache) {
      configuredCache = newsApi
        .aiAnalysisStatus()
        .then((r) => r.data)
        .catch(() => {
          configuredCache = null
          return null
        })
    }
    let alive = true
    configuredCache.then((v) => alive && setState(v))
    return () => {
      alive = false
    }
  }, [])
  return state
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (detail && typeof detail.message === 'string') return detail.message
    if (error.code === 'ECONNABORTED') return 'Claude trả lời quá lâu. Thử lại sau.'
  }
  return 'Không tạo được bản giải thích. Thử lại sau.'
}

const RELATION_LABEL = { DIRECT: 'Trực tiếp', INDIRECT: 'Gián tiếp' } as const

/** Phần "Claude giải thích" trong thẻ tin.
 *
 *  Là lớp GIẢI THÍCH, không phải lớp dự đoán: Claude đọc bài cùng kết quả mô
 *  hình và số đo thật, rồi viết lại bằng lời thường. Backend chặn mọi câu mang
 *  tính khuyến nghị mua bán trước khi nó tới được đây.
 */
export default function AiAnalysisSection({ newsId, initial }: { newsId: number; initial?: AiAnalysis | null }) {
  const status = useAiConfigured()
  const [record, setRecord] = useState<AiAnalysis | null>(initial ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await newsApi.aiAnalysis(newsId)
      setRecord(r.data as AiAnalysis)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  // Chưa có bản nào mà máy chủ lại chưa cấu hình khoá — hoặc chưa trả lời xong
  // câu hỏi đó: không hiện gì. Hiện nút trước rồi mới giấu đi thì người dùng
  // thấy nó nháy lên rồi biến mất; hiện nút khi chưa có khoá thì bấm vào chỉ
  // nhận được thông báo lỗi.
  if (!record && !status?.configured) return null

  return (
    <section
      aria-label="Claude giải thích bài này"
      className="rounded-xl p-3"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      {!record ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
              <Sparkles size={13} style={{ color: '#7c3aed' }} /> Nhờ Claude giải thích bài này
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Tóm tắt chuyện gì xảy ra, ai liên quan, và nên hiểu kết quả của hệ thống thế nào. Mất khoảng 20–60
              giây; mỗi bài chỉ tạo một lần rồi được lưu lại.
            </p>
          </div>
          <button
            onClick={run}
            disabled={loading || !status}
            className="px-3 py-1.5 rounded-lg text-[12px] font-medium flex items-center gap-1.5 disabled:opacity-60"
            style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.25)' }}
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {loading ? 'Claude đang đọc bài…' : 'Giải thích'}
          </button>
          {error && (
            <p className="w-full text-[11px] flex items-start gap-1.5 mt-1" style={{ color: '#b45309' }}>
              <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" /> {error}
            </p>
          )}
        </div>
      ) : (
        <AnalysisBody record={record} />
      )}
    </section>
  )
}

function Heading({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wide mt-2.5 mb-1" style={{ color: 'var(--text-faint)' }}>
      {children}
    </p>
  )
}

function AnalysisBody({ record }: { record: AiAnalysis }) {
  const a = record.analysis
  return (
    <div>
      <p className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
        <Sparkles size={13} style={{ color: '#7c3aed' }} /> Claude giải thích
      </p>

      <Heading>Chuyện gì xảy ra</Heading>
      <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {a.what_happened}
      </p>

      {a.affected.length > 0 && (
        <>
          <Heading>Ai chịu ảnh hưởng</Heading>
          <ul className="space-y-1">
            {a.affected.map((p, i) => (
              <li key={`${p.name}-${i}`} className="text-[12px] flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
                <span
                  className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold flex-shrink-0 mt-0.5"
                  style={
                    p.relation === 'DIRECT'
                      ? { background: 'rgba(37,99,235,0.12)', color: '#2563eb' }
                      : { background: 'rgba(100,116,139,0.12)', color: 'var(--text-muted)' }
                  }
                >
                  {RELATION_LABEL[p.relation]}
                </span>
                <span>
                  <strong style={{ color: 'var(--text-primary)' }}>{p.name}</strong> — {p.why}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <Heading>Hệ thống nói gì, và nên hiểu thế nào</Heading>
      <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {a.model_reading}
      </p>

      {a.risks_to_watch.length > 0 && (
        <>
          <Heading>Điều cần theo dõi</Heading>
          <ul className="text-[12px] list-disc pl-4 space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
            {a.risks_to_watch.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </>
      )}

      <p className="text-[10px] mt-3 pt-2" style={{ color: 'var(--text-faint)', borderTop: '1px dashed var(--border-subtle)' }}>
        {a.limits} Viết bởi {record.model} lúc {new Date(record.generated_at).toLocaleString('vi-VN')}. Có thể sai —
        hãy đối chiếu với bài gốc. Đây là công cụ nghiên cứu, không phải lời khuyên đầu tư.
      </p>
    </div>
  )
}
