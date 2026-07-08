import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Sidebar from './components/Layout/Sidebar'
import Topbar from './components/Layout/Topbar'
import DashboardPage from './pages/DashboardPage'
import ImportPage from './pages/ImportPage'
import AnalysisPage from './pages/AnalysisPage'
import GraphPage from './pages/GraphPage'
import PredictionPage from './pages/PredictionPage'
import EvaluationPage from './pages/EvaluationPage'

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0d1f35',
            color: '#e2e8f0',
            border: '1px solid #1e3556',
            borderRadius: '10px',
            fontSize: '13px',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#0d1f35' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#0d1f35' } },
        }}
      />
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/graph" element={<GraphPage />} />
            <Route path="/prediction" element={<PredictionPage />} />
            <Route path="/evaluation" element={<EvaluationPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
