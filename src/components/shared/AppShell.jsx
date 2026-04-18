// src/components/shared/AppShell.jsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import {
  LayoutDashboard, Briefcase, BookOpen,
  Lightbulb, LogOut, TrendingUp, Menu, X, Zap, ShieldCheck
} from 'lucide-react'
import { useState } from 'react'
import { getTheme, setTheme } from '../../lib/theme'

const NAV = [
  { to: '/',          label: 'Dashboard',    icon: LayoutDashboard, end: true },
  { to: '/portfolios',label: 'Portfolios',   icon: Briefcase },
  { to: '/journal',   label: 'Journal',      icon: BookOpen },
  { to: '/insights',  label: 'Insights',     icon: Lightbulb },
  { to: '/rules',     label: 'Rule Analyst', icon: ShieldCheck },
]

export default function AppShell() {
  const { user, logout, isDemo } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }
  const [theme, setThemeState] = useState(getTheme())

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

  const initials = user?.email?.[0]?.toUpperCase() || '?'

  return (
    <div className="app-shell">
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(v => !v)}
        style={{
          position: 'fixed', top: '1rem', left: '1rem', zIndex: 200,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', padding: '0.4rem',
          display: 'none', alignItems: 'center', color: 'var(--text-primary)'
        }}
        className="mobile-toggle"
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <TrendingUp size={18} color="var(--accent)" />
            Portfolio<span>OS</span>
          </div>
          <div className="sidebar-tagline">Trading Command Center</div>
          <button
            onClick={toggleTheme}
            title="Toggle theme"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '14px',
              lineHeight: 1,
              color: 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {isDemo && (
            <div style={{
              margin: '0.25rem 0 0.75rem',
              padding: '0.5rem 0.65rem',
              background: 'rgba(245,166,35,0.1)',
              border: '1px solid rgba(245,166,35,0.25)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.68rem',
              color: 'var(--amber)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.4rem',
              lineHeight: 1.4
            }}>
              <Zap size={11} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Demo mode — add Firebase config in <code style={{ fontSize: '0.65rem' }}>src/lib/firebase.js</code> to persist data</span>
            </div>
          )}
          <div className="nav-section-label">Navigation</div>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{initials}</div>
            <span className="user-email">{user?.email}</span>
            <button className="logout-btn" onClick={handleLogout} title="Log out">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}