import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const HOME_BY_ROLE: Record<'admin' | 'customer', string> = {
  admin: '/admin/dashboard',
  customer: '/dashboard',
}

export default function ProtectedRoute({
  children,
  role,
}: {
  children: ReactNode
  role?: 'admin' | 'customer'
}) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="w-10 h-10 rounded-full skeleton" />
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (role && user.role !== role) {
    return <Navigate to={HOME_BY_ROLE[user.role]} replace />
  }

  return <>{children}</>
}
