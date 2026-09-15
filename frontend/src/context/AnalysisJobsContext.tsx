import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { newsApi } from '../services/api'
import { useLanguage } from './LanguageContext'

const POLL_MS = 2500
/** Sau mốc này thì ngừng theo dõi. Một tác vụ nền treo không được phép để lại
 *  một vòng lặp gọi API chạy mãi trong tab của người dùng. */
const MAX_WAIT_MS = 5 * 60 * 1000

export interface AnalysisJob {
  id: string
  label: string
  ids: number[]
  total: number
  analyzed: number
  scored: number
  refused: number
  needsReview: number
  symbols: string[]
  startedAt: number
  done: boolean
}

interface AnalysisJobsValue {
  jobs: AnalysisJob[]
  /** Bắt đầu theo dõi một lô bài vừa nhập. */
  track: (ids: number[], label: string) => void
  dismiss: (id: string) => void
  /** Tổng số bài đang chờ phân tích, cho chỉ báo trên thanh trên cùng. */
  pendingCount: number
}

const AnalysisJobsContext = createContext<AnalysisJobsValue | undefined>(undefined)

/** Theo dõi các lô bài đang được phân tích nền, và báo khi xong.
 *
 * Đặt ở tầng layout chứ không trong trang Nhập dữ liệu, vì người dùng thường
 * nhập xong rồi đi xem trang khác ngay. Nếu gắn vào trang nhập, rời trang là
 * mất theo dõi và thông báo không bao giờ đến.
 */
export function AnalysisJobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<AnalysisJob[]>([])
  const navigate = useNavigate()
  const { t } = useLanguage()
  const jobsRef = useRef<AnalysisJob[]>([])
  jobsRef.current = jobs

  const track = useCallback((ids: number[], label: string) => {
    if (!ids.length) return
    setJobs((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label,
        ids,
        total: ids.length,
        analyzed: 0,
        scored: 0,
        refused: 0,
        needsReview: 0,
        symbols: [],
        startedAt: Date.now(),
        done: false,
      },
    ])
  }, [])

  const dismiss = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id))
  }, [])

  const announce = useCallback(
    (job: AnalysisJob) => {
      const target = job.symbols.length === 1 ? `/stocks/${job.symbols[0]}` : '/news'

      toast.custom(
        (toastItem) => (
          <div
            className="rounded-xl px-4 py-3 max-w-sm"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              boxShadow: '0 10px 30px -12px rgba(0,0,0,0.35)',
            }}
          >
            <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('analysisJobs.doneTitle', { total: job.total })}
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {job.scored > 0
                ? t('analysisJobs.scoredSome', { scored: job.scored })
                : t('analysisJobs.scoredNone')}
              {job.refused > 0 && t('analysisJobs.refusedSuffix', { refused: job.refused })}
              {job.needsReview > 0 && t('analysisJobs.needsReviewSuffix', { count: job.needsReview })}
            </p>
            {job.symbols.length > 0 && (
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-faint)' }}>
                {t('analysisJobs.symbolsDetected', {
                  symbols: job.symbols.slice(0, 6).join(', ') + (job.symbols.length > 6 ? '…' : ''),
                })}
              </p>
            )}
            <div className="flex gap-2 mt-2.5">
              <button
                onClick={() => {
                  toast.dismiss(toastItem.id)
                  navigate(target)
                }}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)' }}
              >
                {t('analysisJobs.viewResults')}
              </button>
              {job.scored > 0 && (
                <button
                  onClick={() => {
                    toast.dismiss(toastItem.id)
                    navigate('/prediction')
                  }}
                  className="px-3 py-1.5 rounded-lg text-[12px]"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {t('analysisJobs.viewPredictions')}
                </button>
              )}
              <button
                onClick={() => toast.dismiss(toastItem.id)}
                className="px-2 py-1.5 rounded-lg text-[12px]"
                style={{ color: 'var(--text-faint)' }}
              >
                {t('analysisJobs.close')}
              </button>
            </div>
          </div>
        ),
        // Không tự tắt: đây là thông báo có hành động kèm theo, tắt sau vài
        // giây thì người dùng vừa ngẩng lên đã mất mất đường dẫn.
        { duration: Infinity, position: 'bottom-right' },
      )
    },
    [navigate, t],
  )

  useEffect(() => {
    const active = jobs.filter((j) => !j.done)
    if (active.length === 0) return

    let cancelled = false

    const poll = async () => {
      for (const job of active) {
        if (cancelled) return

        // Quá hạn chờ: dừng theo dõi và nói thẳng là không xác nhận được,
        // thay vì im lặng bỏ cuộc.
        if (Date.now() - job.startedAt > MAX_WAIT_MS) {
          setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, done: true } : j)))
          toast.error(t('analysisJobs.timeoutError', { total: job.total }), { duration: 8000 })
          continue
        }

        try {
          const { data } = await newsApi.analysisStatus(job.ids)
          if (cancelled) return

          const updated: AnalysisJob = {
            ...job,
            analyzed: data.analyzed,
            scored: data.scored ?? 0,
            refused: data.refused ?? 0,
            needsReview: data.needs_review ?? 0,
            symbols: data.symbols ?? [],
            done: data.done,
          }
          setJobs((prev) => prev.map((j) => (j.id === job.id ? updated : j)))

          if (data.done) {
            announce(updated)
            // Giữ lại 2 giây để chỉ báo tiến trình kịp về 100% rồi mới biến mất.
            setTimeout(() => dismiss(job.id), 2000)
          }
        } catch {
          // Một lần gọi lỗi không kết thúc việc theo dõi; lần sau thử lại.
        }
      }
    }

    void poll()
    const timer = setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [jobs, announce, dismiss])

  const pendingCount = jobs
    .filter((j) => !j.done)
    .reduce((sum, j) => sum + (j.total - j.analyzed), 0)

  return (
    <AnalysisJobsContext.Provider value={{ jobs, track, dismiss, pendingCount }}>
      {children}
    </AnalysisJobsContext.Provider>
  )
}

export function useAnalysisJobs() {
  const ctx = useContext(AnalysisJobsContext)
  if (!ctx) throw new Error('useAnalysisJobs must be used within AnalysisJobsProvider')
  return ctx
}
