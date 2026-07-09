import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Sidebar from './components/Layout/Sidebar'
import Topbar from './components/Layout/Topbar'
import AdminSidebar from './components/Layout/AdminSidebar'
import AdminTopbar from './components/Layout/AdminTopbar'
import ProtectedRoute from './components/Auth/ProtectedRoute'
import GuestRoute from './components/Auth/GuestRoute'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import DashboardPage from './pages/DashboardPage'
import ImportPage from './pages/ImportPage'
import AnalysisPage from './pages/AnalysisPage'
import StocksPage from './pages/StocksPage'
import StockDetailPage from './pages/StockDetailPage'
import EventsPage from './pages/EventsPage'
import SentimentPage from './pages/SentimentPage'
import GraphPage from './pages/GraphPage'
import PredictionPage from './pages/PredictionPage'
import EvaluationPage from './pages/EvaluationPage'
import SettingsPage from './pages/SettingsPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminNewsPage from './pages/admin/AdminNewsPage'
import AdminStocksPage from './pages/admin/AdminStocksPage'
import AdminEventKeywordsPage from './pages/admin/AdminEventKeywordsPage'
import AdminDataValidationPage from './pages/admin/AdminDataValidationPage'
import AdminLabelingPage from './pages/admin/AdminLabelingPage'
import AdminValidationResultsPage from './pages/admin/AdminValidationResultsPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminSettingsPage from './pages/admin/AdminSettingsPage'
import AdminProfilePage from './pages/admin/AdminProfilePage'

function AppLayout() {
  return (
    <ProtectedRoute role="customer">
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/news" element={<AnalysisPage />} />
              <Route path="/stocks" element={<StocksPage />} />
              <Route path="/stocks/:symbol" element={<StockDetailPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/sentiment" element={<SentimentPage />} />
              <Route path="/prediction" element={<PredictionPage />} />
              <Route path="/graph" element={<GraphPage />} />
              <Route path="/reports" element={<EvaluationPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/import" element={<ImportPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}

function AdminLayout() {
  return (
    <ProtectedRoute role="admin">
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
        <AdminSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <AdminTopbar />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<AdminDashboardPage />} />
              <Route path="/news" element={<AdminNewsPage />} />
              <Route path="/stocks" element={<AdminStocksPage />} />
              <Route path="/keywords" element={<AdminEventKeywordsPage />} />
              <Route path="/data-validation" element={<AdminDataValidationPage />} />
              <Route path="/labeling" element={<AdminLabelingPage />} />
              <Route path="/validation-results" element={<AdminValidationResultsPage />} />
              <Route path="/users" element={<AdminUsersPage />} />
              <Route path="/settings" element={<AdminSettingsPage />} />
              <Route path="/profile" element={<AdminProfilePage />} />
            </Routes>
          </main>
        </div>
      </div>
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
