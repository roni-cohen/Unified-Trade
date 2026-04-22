// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import AppShell from './components/shared/AppShell'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import PortfoliosPage from './pages/PortfoliosPage'
import PortfolioDetailPage from './pages/PortfolioDetailPage'
import JournalPage from './pages/JournalPage'
import InsightsPage from './pages/InsightsPage'
import RulesPage from './pages/RulesPage'
import TradeHistoryPage from './pages/TradeHistoryPage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        height: '100vh', gap: '1rem',
        color: 'var(--text-muted)', fontFamily: 'var(--font-mono)'
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
          stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"
          style={{ animation: 'spin 1s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ fontSize: '0.8rem' }}>Connecting to Firebase...</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', maxWidth: 320, textAlign: 'center' }}>
          If this persists, check your Firebase config in src/lib/firebase.js and verify
          Email/Password auth is enabled in the Firebase console.
        </span>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="portfolios" element={<PortfoliosPage />} />
        <Route path="portfolios/:id" element={<PortfolioDetailPage />} />
        <Route path="journal" element={<JournalPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="rules" element={<RulesPage />} />
        <Route path="trade-history" element={<TradeHistoryPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}