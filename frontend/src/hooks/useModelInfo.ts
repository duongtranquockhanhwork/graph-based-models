import { useEffect, useState } from 'react'
import { predictionApi } from '../services/api'
import type { ModelInfo } from '../types'

// Một lần gọi cho cả phiên. Thông tin mô hình không đổi trong lúc ứng dụng chạy,
// còn thẻ tin thì xuất hiện hàng chục lần trên một trang — để mỗi thẻ tự gọi API
// là hàng chục request giống hệt nhau cho mỗi lần mở trang.
let cached: Promise<ModelInfo | null> | null = null

export function useModelInfo(): ModelInfo | null {
  const [info, setInfo] = useState<ModelInfo | null>(null)

  useEffect(() => {
    if (!cached) {
      cached = predictionApi
        .modelInfo()
        .then((r) => r.data as ModelInfo)
        .catch(() => {
          // Lỗi thì bỏ cache, để lần mở trang sau thử lại thay vì kẹt ở null.
          cached = null
          return null
        })
    }
    let alive = true
    cached.then((value) => {
      if (alive) setInfo(value)
    })
    return () => {
      alive = false
    }
  }, [])

  return info
}
