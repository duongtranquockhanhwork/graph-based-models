import { useCallback, useEffect, useRef, useState } from 'react'

/** Phiên giao dịch HOSE/HNX, giờ Việt Nam.
 *  Sáng 09:00–11:30 · Chiều 13:00–14:45 (ATC tới 14:45), Thứ 2–Thứ 6. */
const SESSIONS: [number, number][] = [
  [9 * 60, 11 * 60 + 30],
  [13 * 60, 14 * 60 + 45],
]

/** Giờ Việt Nam, không phụ thuộc múi giờ máy người dùng. */
function vietnamNow(): { minutes: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(new Date())

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const hour = parseInt(get('hour'), 10)
  const minute = parseInt(get('minute'), 10)
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { minutes: hour * 60 + minute, weekday: weekdayMap[get('weekday')] ?? 0 }
}

export function isMarketOpen(): boolean {
  const { minutes, weekday } = vietnamNow()
  if (weekday === 0 || weekday === 6) return false
  return SESSIONS.some(([start, end]) => minutes >= start && minutes <= end)
}

export interface AutoRefreshOptions {
  /** Chu kỳ khi thị trường đang mở (ms). 0 = tắt tự động cập nhật. */
  intervalMs: number
  /** Hệ số giãn chu kỳ khi thị trường đã đóng. Giá không đổi ngoài phiên,
   *  nên gọi API với cùng nhịp chỉ tốn hạn mức của nguồn dữ liệu. */
  closedMultiplier?: number
  enabled?: boolean
}

export interface AutoRefreshState {
  /** Lần cập nhật thành công gần nhất. */
  lastUpdated: Date | null
  /** Số giây còn lại tới lần cập nhật kế tiếp; null khi đang tắt hoặc tạm dừng. */
  secondsLeft: number | null
  /** Tạm dừng vì tab đang ẩn. */
  paused: boolean
  marketOpen: boolean
  refreshing: boolean
  /** Cập nhật ngay, và đặt lại bộ đếm. */
  refreshNow: () => void
}

/** Gọi `fetcher` theo chu kỳ, có ba hành vi mà một `setInterval` trần không có:
 *
 *  1. **Tạm dừng khi tab bị ẩn.** Một tab để quên sẽ gọi API suốt đêm. Nguồn
 *     dữ liệu vnstock có hạn mức, và người dùng không nhìn thì dữ liệu mới
 *     cũng vô nghĩa. Khi tab hiện lại, cập nhật ngay một lần.
 *  2. **Giãn nhịp ngoài giờ giao dịch.** Giá không đổi sau 14:45 và cuối tuần.
 *  3. **Đếm ngược hiển thị được**, để người dùng biết dữ liệu cũ bao lâu rồi
 *     thay vì nhìn một bảng số không rõ có còn sống hay không.
 */
export function useAutoRefresh(
  fetcher: () => Promise<void> | void,
  { intervalMs, closedMultiplier = 6, enabled = true }: AutoRefreshOptions,
): AutoRefreshState {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [paused, setPaused] = useState(() => document.visibilityState === 'hidden')
  const [marketOpen, setMarketOpen] = useState(() => isMarketOpen())
  const [refreshing, setRefreshing] = useState(false)

  // Giữ fetcher trong ref để việc component render lại không khởi động lại
  // vòng lặp — nếu không, mỗi lần render là một lần gọi API.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const inFlight = useRef(false)
  const deadline = useRef<number | null>(null)

  const effectiveInterval = intervalMs > 0 ? intervalMs * (marketOpen ? 1 : closedMultiplier) : 0

  const run = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setRefreshing(true)
    try {
      await fetcherRef.current()
      setLastUpdated(new Date())
    } finally {
      inFlight.current = false
      setRefreshing(false)
    }
  }, [])

  const refreshNow = useCallback(() => {
    deadline.current = effectiveInterval > 0 ? Date.now() + effectiveInterval : null
    void run()
  }, [run, effectiveInterval])

  useEffect(() => {
    const onVisibility = () => {
      const hidden = document.visibilityState === 'hidden'
      setPaused(hidden)
      if (!hidden) {
        // Tab vừa hiện lại: dữ liệu trên màn hình đã cũ, cập nhật ngay.
        deadline.current = effectiveInterval > 0 ? Date.now() + effectiveInterval : null
        void run()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [run, effectiveInterval])

  // Nạp lần đầu.
  useEffect(() => {
    if (enabled) void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  // Một tick 1 giây lo cả ba việc: đếm ngược, kiểm tra tới hạn, và cập nhật
  // trạng thái phiên. Dùng một timer duy nhất thay vì ba timer chạy song song.
  useEffect(() => {
    if (!enabled || effectiveInterval <= 0) {
      setSecondsLeft(null)
      deadline.current = null
      return
    }
    if (deadline.current === null) deadline.current = Date.now() + effectiveInterval

    const tick = () => {
      setMarketOpen(isMarketOpen())
      if (paused) {
        setSecondsLeft(null)
        // Dời hạn để tab hiện lại không kích hoạt một loạt lần gọi dồn.
        deadline.current = Date.now() + effectiveInterval
        return
      }
      const remaining = (deadline.current ?? 0) - Date.now()
      if (remaining <= 0) {
        deadline.current = Date.now() + effectiveInterval
        void run()
        setSecondsLeft(Math.ceil(effectiveInterval / 1000))
      } else {
        setSecondsLeft(Math.ceil(remaining / 1000))
      }
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [enabled, effectiveInterval, paused, run])

  return { lastUpdated, secondsLeft, paused, marketOpen, refreshing, refreshNow }
}
