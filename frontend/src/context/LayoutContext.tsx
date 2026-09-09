import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

interface LayoutContextValue {
  sidebarOpen: boolean
  openSidebar: () => void
  closeSidebar: () => void
  toggleSidebar: () => void
}

const LayoutContext = createContext<LayoutContextValue | undefined>(undefined)

/** Trạng thái mở/đóng của sidebar ở khổ hẹp.
 *
 * Ở màn hình lớn sidebar luôn hiển thị (lg:static lg:translate-x-0), nên giá
 * trị này chỉ có tác dụng dưới ngưỡng lg. Đặt ở context vì cả Sidebar (để
 * trượt) lẫn Topbar (nút mở) đều cần nó, và hai component đó không có quan hệ
 * cha–con.
 */
export function LayoutProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { pathname } = useLocation()

  const openSidebar = useCallback(() => setSidebarOpen(true), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), [])

  // Chuyển trang thì đóng lại — nếu không, trên điện thoại người dùng bấm một
  // mục rồi vẫn thấy sidebar che kín trang vừa mở.
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Esc để đóng: sidebar ở khổ hẹp là một lớp phủ, và mọi lớp phủ nên đóng
  // được bằng bàn phím.
  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  return (
    <LayoutContext.Provider value={{ sidebarOpen, openSidebar, closeSidebar, toggleSidebar }}>
      {children}
    </LayoutContext.Provider>
  )
}

export function useLayout() {
  const ctx = useContext(LayoutContext)
  if (!ctx) throw new Error('useLayout must be used within LayoutProvider')
  return ctx
}
