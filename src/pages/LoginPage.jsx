// src/pages/LoginPage.jsx
import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { TrendingUp, Terminal } from 'lucide-react'

export default function LoginPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password)
    } catch (err) {
      setError(err.message.replace('Firebase: ', '').replace(/\(auth\/[^)]+\)\.?/, '').trim())
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      padding: '1rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          linear-gradient(var(--border) 1px, transparent 1px),
          linear-gradient(90deg, var(--border) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        opacity: 0.4
      }} />
      {/* Glow */}
      <div style={{
        position: 'absolute',
        width: '500px', height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,212,170,0.06) 0%, transparent 70%)',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none'
      }} />

      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '400px',
        animation: 'fadeIn 0.5s ease'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '52px', height: '52px',
            background: 'var(--accent-dim)',
            border: '1px solid rgba(0,212,170,0.3)',
            borderRadius: '12px',
            marginBottom: '1rem'
          }}>
            <TrendingUp size={24} color="var(--accent)" />
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.5rem',
            fontWeight: 800,
            letterSpacing: '-0.02em'
          }}>
            Portfolio<span style={{ color: 'var(--accent)' }}>OS</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Trading Command Center
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-bright)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          boxShadow: 'var(--shadow-lg)'
        }}>
          {/* Mode toggle */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-sm)',
            padding: '3px',
            marginBottom: '1.5rem',
            gap: '3px'
          }}>
            {['login', 'register'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError('') }}
                style={{
                  flex: 1,
                  padding: '0.45rem',
                  borderRadius: '3px',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  transition: 'all 0.2s',
                  background: mode === m ? 'var(--bg-surface)' : 'transparent',
                  color: mode === m ? 'var(--accent)' : 'var(--text-muted)',
                  boxShadow: mode === m ? 'var(--shadow-sm)' : 'none',
                  cursor: 'pointer'
                }}
              >
                {m}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="trader@example.com"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div style={{
                background: 'var(--red-dim)',
                border: '1px solid rgba(255,77,109,0.2)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.6rem 0.75rem',
                fontSize: '0.78rem',
                color: 'var(--red)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Terminal size={13} />
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '0.65rem', marginTop: '0.5rem', fontSize: '0.82rem' }}
            >
              {loading ? 'Processing...' : mode === 'login' ? 'Access Terminal' : 'Create Account'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
          Secure · Personal · Real-time
        </div>
      </div>
    </div>
  )
}
