// src/pages/PortfoliosPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { usePortfolios } from '../hooks/usePortfolios'
import { createPortfolio, deletePortfolio } from '../lib/db'
import { Briefcase, Plus, Trash2, ArrowRight, TrendingUp } from 'lucide-react'

const PALETTE = ['#00d4aa','#3d8ef0','#f5a623','#ff4d6d','#a78bfa','#34d399','#fb923c']

export default function PortfoliosPage() {
  const { user } = useAuth()
  const { portfolios, loading } = usePortfolios()
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', broker: '' })
  const [creating, setCreating] = useState(false)

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setCreating(true)
    try {
      await createPortfolio(user.uid, { ...form, color: PALETTE[portfolios.length % PALETTE.length] })
      setForm({ name: '', description: '', broker: '' })
      setShowModal(false)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    if (!confirm('Delete this portfolio and all its positions?')) return
    await deletePortfolio(id)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title"><Briefcase size={18} color="var(--accent)" /> Portfolios</div>
          <div className="page-subtitle">{portfolios.length} portfolio{portfolios.length !== 1 ? 's' : ''} tracked</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={14} /> New Portfolio
        </button>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>Loading...</div>
        ) : portfolios.length === 0 ? (
          <div style={{ textAlign:'center', padding:'4rem 2rem' }}>
            <Briefcase size={40} color="var(--text-dim)" style={{ marginBottom:'1rem' }} />
            <div style={{ fontFamily:'var(--font-display)', fontSize:'1.1rem', fontWeight:600, marginBottom:'0.5rem' }}>No portfolios yet</div>
            <div style={{ color:'var(--text-muted)', fontSize:'0.82rem', marginBottom:'1.5rem' }}>Create your first portfolio to start tracking positions</div>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> Create Portfolio</button>
          </div>
        ) : (
          <div className="grid-3">
            {portfolios.map((p, i) => (
              <div
                key={p.id}
                className="card"
                onClick={() => navigate(`/portfolios/${p.id}`)}
                style={{ cursor:'pointer', transition:'all 0.2s', position:'relative', animation:`fadeIn ${0.3 + i*0.08}s ease` }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = p.color }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                {/* Color bar */}
                <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:p.color, borderRadius:'var(--radius-lg) var(--radius-lg) 0 0' }} />

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem' }}>
                  <div style={{
                    width:36, height:36, borderRadius:'8px',
                    background: p.color + '20',
                    border: `1px solid ${p.color}40`,
                    display:'flex', alignItems:'center', justifyContent:'center'
                  }}>
                    <TrendingUp size={16} color={p.color} />
                  </div>
                  <button
                    className="btn btn-danger"
                    style={{ padding:'0.3rem 0.5rem', fontSize:'0.7rem' }}
                    onClick={e => handleDelete(p.id, e)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                <div style={{ fontFamily:'var(--font-display)', fontSize:'1.05rem', fontWeight:700, marginBottom:'0.25rem' }}>{p.name}</div>
                {p.description && <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'0.75rem' }}>{p.description}</div>}
                {p.broker && <div style={{ fontSize:'0.7rem', color:'var(--text-dim)', marginBottom:'0.75rem' }}>via {p.broker}</div>}

                <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'0.5rem' }}>
                  <span style={{ fontSize:'0.72rem', color:'var(--accent)', display:'flex', alignItems:'center', gap:'0.3rem' }}>
                    Open <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            ))}

            {/* Add new card */}
            <div
              className="card"
              onClick={() => setShowModal(true)}
              style={{
                cursor:'pointer', display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', gap:'0.75rem',
                minHeight:'160px', borderStyle:'dashed', transition:'all 0.2s',
                color:'var(--text-muted)'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              <Plus size={22} />
              <span style={{ fontSize:'0.8rem', fontWeight:500 }}>New Portfolio</span>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'1.1rem', fontWeight:700, marginBottom:'1.5rem' }}>
              Create Portfolio
            </div>
            <form onSubmit={handleCreate} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              <Field label="Portfolio Name *">
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Growth Fund, Tech Bets" required />
              </Field>
              <Field label="Broker / Platform">
                <input value={form.broker} onChange={e => setForm(f => ({ ...f, broker: e.target.value }))} placeholder="e.g. Fidelity, Robinhood, IBKR" />
              </Field>
              <Field label="Description">
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What's the strategy for this portfolio?" rows={3} style={{ resize:'vertical' }} />
              </Field>
              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end', marginTop:'0.5rem' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Portfolio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:'0.65rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'0.4rem' }}>{label}</label>
      {children}
    </div>
  )
}
