import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Sidebar from './components/Layout/Sidebar'
import Topbar from './components/Layout/Topbar'
import AdminSidebar from './components/Layout/AdminSidebar'
import AdminTopbar from './components/Layout/AdminTopbar'
import ProtectedRoute from './components/Auth/ProtectedRoute'
import GuestRoute from './components/Auth/GuestRoute'
import { LayoutProvider } from './context/LayoutContext'
import { AnalysisJobsProvider } from './context/AnalysisJobsContext'

// Các trang xác thực nằm trong bundle chính: chúng là thứ đầu tiên mọi khách
// truy cập nhìn thấy, nên không nên phải chờ tải thêm chunk.
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'

// Phần còn lại tách thành chunk riêng. Trước đây toàn bộ ứng dụng — kể cả 10
// trang quản trị và thư viện biểu đồ — nằm trong một file 919 kB mà trang
// đăng nhập cũng phải tải hết.
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ImportPage = lazy(() => import('./pages/ImportPage'))
const FeedPage = lazy(() => import('./pages/FeedPage'))
const GraphPage = lazy(() => import('./pages/GraphPage'))
const StocksPage = lazy(() => import('./pages/StocksPage'))
const StockWorkspacePage = lazy(() => import('./pages/StockWorkspacePage'))
const EvaluationPage = lazy(() => import('./pages/EvaluationPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'))
const AdminNewsPage = lazy(() => import('./pages/admin/AdminNewsPage'))
const AdminLabelingPage = lazy(() => import('./pages/admin/AdminLabelingPage'))
const AdminQualityPage = lazy(() => import('./pages/admin/AdminQualityPage'))
const AdminTuningPage = lazy(() => import('./pages/admin/AdminTuningPage'))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'))
const AdminProfilePage = lazy(() => import('./pages/admin/AdminProfilePage'))

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 rounded-full skeleton" />
    </div>
  )
}

function AppLayout() {
  return (
    <ProtectedRoute role="customer">
      <LayoutProvider>
        <AnalysisJobsProvider>
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <Topbar />
            <main className="flex-1 overflow-y-auto">
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/feed" element={<FeedPage />} />
                  <Route path="/graph" element={<GraphPage />} />
                  <Route path="/stocks" element={<StocksPage />} />
                  <Route path="/stocks/:symbol" element={<StockWorkspacePage />} />
                  <Route path="/reports" element={<EvaluationPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/import" element={<ImportPage />} />

                  {/* Đường dẫn cũ vẫn dùng được: liên kết đã chia sẻ, dấu
                      trang, và mọi chỗ trong mã còn trỏ tới chúng đều đáp
                      xuống đúng lát cắt tương ứng của trang mới. */}
                  <Route path="/news" element={<Navigate to="/feed" replace />} />
                  <Route path="/events" element={<Navigate to="/feed" replace />} />
                  <Route path="/sentiment" element={<Navigate to="/feed" replace />} />
                  <Route path="/prediction" element={<Navigate to="/feed?has_prediction=1" replace />} />
                  <Route path="/live" element={<Navigate to="/stocks" replace />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Suspense>
            </main>
          </div>
        </div>
        </AnalysisJobsProvider>
      </LayoutProvider>
    </ProtectedRoute>
  )
}

function AdminLayout() {
  return (
    <ProtectedRoute role="admin">
      <LayoutProvider>
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
          <AdminSidebar />
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <AdminTopbar />
            <main className="flex-1 overflow-y-auto">
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<AdminDashboardPage />} />
                  <Route path="/news" element={<AdminNewsPage />} />
                  <Route path="/labeling" element={<AdminLabelingPage />} />
                  <Route path="/quality" element={<AdminQualityPage />} />
                  <Route path="/tuning" element={<AdminTuningPage />} />
                  <Route path="/users" element={<AdminUsersPage />} />
                  {/* Quản trị viên bị ProtectedRoute chặn khỏi khu vực khách
                      hàng, nên trang Cổ phiếu được gắn lại ở đây thay vì bắt
                      họ đăng xuất để xem giá. */}
                  <Route path="/live" element={<StocksPage />} />
                  <Route path="/stocks/:symbol" element={<StockWorkspacePage />} />
                  <Route path="/profile" element={<AdminProfilePage />} />

                  {/* Đường dẫn cũ vẫn đáp xuống đúng trang đã gộp. */}
                  <Route path="/data-validation" element={<Navigate to="/admin/quality" replace />} />
                  <Route path="/validation-results" element={<Navigate to="/admin/quality" replace />} />
                  <Route path="/keywords" element={<Navigate to="/admin/tuning" replace />} />
                  <Route path="/settings" element={<Navigate to="/admin/tuning" replace />} />
                  <Route path="/stocks" element={<Navigate to="/admin/live" replace />} />
                  <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
                </Routes>
              </Suspense>
            </main>
          </div>
        </div>
      </LayoutProvider>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
            borderRadius: '10px',
            fontSize: '13px',
          },
          success: { iconTheme: { primary: '#10b981', secondary: 'var(--bg-card)' } },
          error: { iconTheme: { primary: '#ef4444', secondary: 'var(--bg-card)' } },
        }}
      />
      <Routes>
        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />
        <Route
          path="/register"
          element={
            <GuestRoute>
              <RegisterPage />
            </GuestRoute>
          }
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/admin/*" element={<AdminLayout />} />
        <Route path="/*" element={<AppLayout />} />
      </Routes>
    </>
  )
}
