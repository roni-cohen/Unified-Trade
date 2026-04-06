// src/pages/JournalPage.jsx
import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { subscribeJournal, addJournalEntry, updateJournalEntry, deleteJournalEntry } from '../lib/db'
import { BookOpen, Plus, Trash2, Edit2, X, Check, Tag, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const MOODS = [
  { value: 'confident', label: '💪 Confident', color: 'var(--green)' },
  { value: 'neutral',   label: '😐 Neutral',   color: 'var(--text-secondary)' },
  { value: 'cautious',  label: '🤔 Cautious',  color: 'var(--amber)' },
  { value: 'fearful',   label: '😰 Fearful',   color: 'var(--red)' },
  { value: 'greedy',    label: '🤑 Greedy',    color: 'var(--amber)' },
]

const OUTCOMES = [
  { value: 'win',   label: 'Win',       icon: TrendingUp,   color: 'var(--green)' },
  { value: 'loss',  label: 'Loss',      icon: TrendingDown, color: 'var(--red)' },
  { value: 'open',  label: 'Still Open', icon: Minus,       color: 'var(--text-secondary)' },
]

const STRATEGIES = ['Momentum', 'Value', 'Swing', 'Scalp', 'Earnings', 'Breakout', 'Reversal', 'Buy & Hold', 'Hedge', 'Other']

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  ticker: '',
  action: 'buy',
  shares: '',
  price: '',
  mood: 'neutral',
  strategy: '',
  outcome: 'open',
  pnl: '',
  notes: '',
  tags: [],
}

export default function JournalPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState({ outcome: 'all', strategy: 'all' })
  const [tagInput, setTagInput] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    const unsub = subscribeJournal(user.uid, data => { setEntries(data); setLoading(false) })
    return unsub
  }, [user])

  const openNew = () => {
    setEditingId(null)
    setForm(emptyForm)
    setTagInput('')
    setShowModal(true)
  }

  const openEdit = (e) => {
    setEditingId(e.id)
    setForm({ ...emptyForm, ...e, tags: e.tags || [] })
    setTagInput('')
    setShowModal(true)
  }

  const handleSave = async (ev) => {
    ev.preventDefault()
    setSaving(true)
    try {
      const data = { ...form, pnl: form.pnl ? parseFloat(form.pnl) : null, shares: form.shares ? parseFloat(form.shares) : null, price: form.price ? parseFloat(form.price) : null }
      if (editingId) await updateJournalEntry(editingId, data)
      else await addJournalEntry(user.uid, data)
      setShowModal(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this journal entry?')) return
    await deleteJournalEntry(id)
  }

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) {
      setForm(f => ({ ...f, tags: [...f.tags, t] }))
    }
    setTagInput('')
  }

  const removeTag = (t) => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))

  const filtered = entries.filter(e => {
    if (filter.outcome !== 'all' && e.outcome !== filter.outcome) return false
    if (filter.strategy !== 'all' && e.strategy !== filter.strategy) return false
    return true
  })

  // Stats
  const wins = entries.filter(e => e.outcome === 'win').length
  const losses = entries.filter(e => e.outcome === 'loss').length
  const totalPnl = entries.reduce((s, e) => s + (e.pnl || 0), 0)
  const winRate = entries.filter(e => e.outcome !== 'open').length > 0
    ? Math.round((wins / entries.filter(e => e.outcome !== 'open').length) * 100)
    : 0

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title"><BookOpen size={18} color="var(--accent)" /> Trading Journal</div>
          <div className="page-subtitle">{entries.length} entries logged</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={14} /> New Entry</button>
      </div>

      <div className="page-body">
        {/* Stats strip */}
        <div className="grid-4" style={{ marginBottom:'1.5rem' }}>
          {[
            { label:'Total Entries', value: entries.length, color:'accent' },
            { label:'Win Rate', value: `${winRate}%`, color: winRate >= 50 ? 'green' : 'red' },
            { label:'Total P&L', value: totalPnl >= 0 ? `+$${totalPnl.toFixed(2)}` : `-$${Math.abs(totalPnl).toFixed(2)}`, color: totalPnl >= 0 ? 'green' : 'red' },
            { label:'Wins / Losses', value: `${wins} / ${losses}`, color:'amber' },
          ].map((s, i) => (
            <div key={i} className={`stat-card ${s.color}`}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize:'1.3rem' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1.25rem', flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontSize:'0.7rem', color:'var(--text-muted)', letterSpacing:'0.1em', textTransform:'uppercase' }}>Filter:</span>
          <FilterBtn options={['all','win','loss','open']} value={filter.outcome} onChange={v => setFilter(f => ({ ...f, outcome:v }))} label="Outcome" />
          <FilterBtn options={['all',...STRATEGIES]} value={filter.strategy} onChange={v => setFilter(f => ({ ...f, strategy:v }))} label="Strategy" />
        </div>

        {loading ? (
          <div style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>Loading journal...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'4rem 2rem' }}>
            <BookOpen size={40} color="var(--text-dim)" style={{ marginBottom:'1rem' }} />
            <div style={{ fontFamily:'var(--font-display)', fontSize:'1.1rem', fontWeight:600, marginBottom:'0.5rem' }}>No entries yet</div>
            <div style={{ color:'var(--text-muted)', fontSize:'0.82rem', marginBottom:'1.5rem' }}>Document your trades, thoughts and lessons</div>
            <button className="btn btn-primary" onClick={openNew}><Plus size={14} /> Add First Entry</button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            {filtered.map((entry, i) => {
              const outcome = OUTCOMES.find(o => o.value === entry.outcome)
              const mood = MOODS.find(m => m.value === entry.mood)
              const isExpanded = expandedId === entry.id
              const OutcomeIcon = outcome?.icon || Minus

              return (
                <div
                  key={entry.id}
                  className="card"
                  style={{ padding:'1.25rem 1.5rem', cursor:'pointer', transition:'all 0.18s', animation:`fadeIn ${0.25 + i*0.05}s ease` }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-bright)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  {/* Header row */}
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'1rem' }} onClick={() => setExpandedId(isExpanded ? null : entry.id)}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', flex:1, flexWrap:'wrap' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                        <OutcomeIcon size={14} color={outcome?.color} />
                        <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.95rem' }}>
                          {entry.ticker ? entry.ticker.toUpperCase() : 'Trade'}
                        </span>
                      </div>
                      <span style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>
                        {entry.date ? format(parseISO(entry.date), 'MMM d, yyyy') : ''}
                      </span>
                      {entry.action && (
                        <span className={`tag ${entry.action === 'buy' ? 'tag-green' : entry.action === 'sell' ? 'tag-red' : 'tag-amber'}`}>
                          {entry.action.toUpperCase()}
                        </span>
                      )}
                      {entry.strategy && <span className="tag tag-blue">{entry.strategy}</span>}
                      {mood && <span style={{ fontSize:'0.78rem' }}>{mood.label}</span>}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', flexShrink:0 }}>
                      {entry.pnl !== null && entry.pnl !== undefined && (
                        <span style={{ fontWeight:600, color: entry.pnl >= 0 ? 'var(--green)' : 'var(--red)', fontFamily:'var(--font-display)' }}>
                          {entry.pnl >= 0 ? '+' : ''}${Math.abs(entry.pnl).toFixed(2)}
                        </span>
                      )}
                      <button className="btn btn-ghost" style={{ padding:'0.3rem 0.5rem' }} onClick={ev => { ev.stopPropagation(); openEdit(entry) }}><Edit2 size={12} /></button>
                      <button className="btn btn-danger" style={{ padding:'0.3rem 0.5rem' }} onClick={ev => { ev.stopPropagation(); handleDelete(entry.id) }}><Trash2 size={12} /></button>
                    </div>
                  </div>

                  {/* Expanded body */}
                  {isExpanded && (
                    <div style={{ marginTop:'1rem', paddingTop:'1rem', borderTop:'1px solid var(--border)', animation:'fadeIn 0.2s ease' }}>
                      {(entry.shares || entry.price) && (
                        <div style={{ display:'flex', gap:'1.5rem', marginBottom:'0.75rem', fontSize:'0.8rem', color:'var(--text-secondary)' }}>
                          {entry.shares && <span>Shares: <strong style={{ color:'var(--text-primary)' }}>{entry.shares}</strong></span>}
                          {entry.price && <span>Price: <strong style={{ color:'var(--text-primary)' }}>${entry.price}</strong></span>}
                          {entry.shares && entry.price && <span>Total: <strong style={{ color:'var(--text-primary)' }}>${(entry.shares * entry.price).toFixed(2)}</strong></span>}
                        </div>
                      )}
                      {entry.notes && (
                        <div style={{ fontSize:'0.82rem', color:'var(--text-secondary)', lineHeight:1.7, whiteSpace:'pre-wrap', background:'var(--bg-elevated)', padding:'0.75rem 1rem', borderRadius:'var(--radius-sm)', marginBottom:'0.75rem' }}>
                          {entry.notes}
                        </div>
                      )}
                      {entry.tags?.length > 0 && (
                        <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' }}>
                          {entry.tags.map(t => (
                            <span key={t} className="tag tag-accent"><Tag size={9} style={{ marginRight:2 }} />{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth:580 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
              <div style={{ fontFamily:'var(--font-display)', fontSize:'1.1rem', fontWeight:700 }}>
                {editingId ? 'Edit Entry' : 'New Journal Entry'}
              </div>
              <button style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }} onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
                <Field label="Date"><input type="date" value={form.date} onChange={e => setForm(f => ({...f, date:e.target.value}))} /></Field>
                <Field label="Ticker">
                  <input value={form.ticker} onChange={e => setForm(f => ({...f, ticker: e.target.value.toUpperCase()}))} placeholder="AAPL" />
                </Field>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.75rem' }}>
                <Field label="Action">
                  <select value={form.action} onChange={e => setForm(f => ({...f, action:e.target.value}))}>
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                    <option value="short">Short</option>
                    <option value="cover">Cover</option>
                  </select>
                </Field>
                <Field label="Shares">
                  <input type="number" step="any" min="0" value={form.shares} onChange={e => setForm(f => ({...f, shares:e.target.value}))} placeholder="10" />
                </Field>
                <Field label="Price">
                  <input type="number" step="any" min="0" value={form.price} onChange={e => setForm(f => ({...f, price:e.target.value}))} placeholder="150.00" />
                </Field>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.75rem' }}>
                <Field label="Outcome">
                  <select value={form.outcome} onChange={e => setForm(f => ({...f, outcome:e.target.value}))}>
                    {OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="P&L ($)">
                  <input type="number" step="any" value={form.pnl} onChange={e => setForm(f => ({...f, pnl:e.target.value}))} placeholder="250.00" />
                </Field>
                <Field label="Mood">
                  <select value={form.mood} onChange={e => setForm(f => ({...f, mood:e.target.value}))}>
                    {MOODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Strategy">
                <select value={form.strategy} onChange={e => setForm(f => ({...f, strategy:e.target.value}))}>
                  <option value="">— Select strategy —</option>
                  {STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>

              <Field label="Notes / Rationale">
                <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))} placeholder="Why did you make this trade? What did you learn?" rows={4} style={{ resize:'vertical' }} />
              </Field>

              {/* Tags */}
              <Field label="Tags">
                <div style={{ display:'flex', gap:'0.5rem' }}>
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key==='Enter'){ e.preventDefault(); addTag() }}} placeholder="Add tag, press Enter" style={{ flex:1 }} />
                  <button type="button" className="btn btn-ghost" onClick={addTag}><Plus size={13} /></button>
                </div>
                {form.tags.length > 0 && (
                  <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', marginTop:'0.5rem' }}>
                    {form.tags.map(t => (
                      <span key={t} className="tag tag-accent" style={{ cursor:'pointer' }} onClick={() => removeTag(t)}>
                        {t} <X size={9} />
                      </span>
                    ))}
                  </div>
                )}
              </Field>

              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end', marginTop:'0.25rem' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingId ? <><Check size={13}/> Update</> : <><Plus size={13}/> Save Entry</>}
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

function FilterBtn({ options, value, onChange }) {
  return (
    <div style={{ display:'flex', gap:'0.3rem', flexWrap:'wrap' }}>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt)} style={{
          padding:'0.25rem 0.65rem', borderRadius:'var(--radius-sm)', fontSize:'0.72rem',
          border: value===opt ? '1px solid var(--accent)' : '1px solid var(--border)',
          background: value===opt ? 'var(--accent-dim)' : 'transparent',
          color: value===opt ? 'var(--accent)' : 'var(--text-muted)',
          cursor:'pointer', textTransform:'capitalize'
        }}>{opt}</button>
      ))}
    </div>
  )
}
