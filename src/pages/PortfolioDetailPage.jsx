// src/pages/PortfolioDetailPage.jsx
import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { subscribePositions, addPosition, updatePosition, deletePosition, saveSnapshot } from '../lib/db'
import { useLivePrices } from '../hooks/useLivePrices'
import { fetchHistoricalData } from '../lib/stockApi'
import { usePortfolios } from '../hooks/usePortfolios'
import { getSnapshots } from '../lib/db'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts'
import { ArrowLeft, Plus, Trash2, Edit2, RefreshCw, TrendingUp, TrendingDown, X, Check } from 'lucide-react'

function fmtUSD(n) {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}
function fmtPct(n) {
  if (n === undefined || isNaN(n)) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

const RANGES = ['1w', '1m', '3m', '6m', '1y']

export default function PortfolioDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { portfolios } = usePortfolios()
  const portfolio = portfolios.find(p => p.id === id)

  const [positions, setPositions] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ ticker: '', shares: '', avgCost: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const [histData, setHistData] = useState([])
  const [range, setRange] = useState('1m')
  const [focusTicker, setFocusTicker] = useState(null)
  const [loadingHist, setLoadingHist] = useState(false)
  const [snapshots, setSnapshots] = useState([])



  useEffect(() => {
    const unsub = subscribePositions(id, data => setPositions(data))
    return unsub
  }, [id])

  const tickers = useMemo(() => [...new Set(positions.map(p => p.ticker.toUpperCase()))], [positions])
  const { prices, loading: priceLoading, lastUpdated, refresh } = useLivePrices(tickers)

  useEffect(() => {
    getSnapshots(id).then(data => {
      // Deduplicate by date — keep latest value per day
      const byDate = {}
      data.forEach(s => { byDate[s.date] = s.totalValue })
      const chartData = Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value
        }))
      setSnapshots(chartData)
    })
  }, [id, lastUpdated])

  const enriched = useMemo(() => positions.map(pos => {
    const pd = prices[pos.ticker.toUpperCase()]
    const currentPrice = pd?.price ?? pos.avgCost
    const currentValue = currentPrice * pos.shares
    const costBasis = pos.avgCost * pos.shares
    const gainLoss = currentValue - costBasis
    const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0
    const dayChange = pd?.changePercent ?? 0
    const dayChangeAbs = pd?.change ?? 0
    return { ...pos, currentPrice, currentValue, costBasis, gainLoss, gainLossPct, dayChange, dayChangeAbs }
  }), [positions, prices])

  const totals = useMemo(() => {
    const totalValue = enriched.reduce((s, p) => s + p.currentValue, 0)
    const totalCost = enriched.reduce((s, p) => s + p.costBasis, 0)
    const totalGL = totalValue - totalCost
    const totalGLPct = totalCost > 0 ? (totalGL / totalCost) * 100 : 0
    return { totalValue, totalCost, totalGL, totalGLPct }
  }, [enriched])

    // Auto-save snapshot whenever prices refresh
  useEffect(() => {
    if (!tickers.length || !Object.keys(prices).length) return
    const totalValue = enriched.reduce((s, p) => s + p.currentValue, 0)
    if (totalValue > 0) saveSnapshot(id, user.uid, totalValue)
  }, [lastUpdated])

  // Load historical for focused ticker
  useEffect(() => {
    const ticker = focusTicker || tickers[0]
    if (!ticker) return
    setLoadingHist(true)
    fetchHistoricalData(ticker, range).then(d => { setHistData(d); setLoadingHist(false) })
  }, [focusTicker, range, tickers.join(',')])

  const handleSaveSnapshot = async () => {
    await saveSnapshot(id, user.uid, totals.totalValue)
    alert('Snapshot saved!')
  }

  const handleAddOrUpdate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingId) {
        await updatePosition(editingId, form)
        setEditingId(null)
      } else {
        await addPosition(id, user.uid, form)
      }
      setForm({ ticker: '', shares: '', avgCost: '', notes: '' })
      setShowAdd(false)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (pos) => {
    setEditingId(pos.id)
    setForm({ ticker: pos.ticker, shares: String(pos.shares), avgCost: String(pos.avgCost), notes: pos.notes || '' })
    setShowAdd(true)
  }

  const handleDelete = async (pid) => {
    if (!confirm('Remove this position?')) return
    await deletePosition(pid)
  }

  const isUp = totals.totalGL >= 0
  const displayTicker = focusTicker || tickers[0]

  return (
    <>
      <div className="page-header">
        <div>
          <button onClick={() => navigate('/portfolios')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', marginBottom: '0.35rem', padding: 0 }}>
            <ArrowLeft size={13} /> Portfolios
          </button>
          <div className="page-title">
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: portfolio?.color || 'var(--accent)' }} />
            {portfolio?.name || 'Portfolio'}
          </div>
          {portfolio?.broker && <div className="page-subtitle">via {portfolio.broker}</div>}
        </div>
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {lastUpdated && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Updated {lastUpdated.toLocaleTimeString()}</span>}
          <button className="btn btn-ghost" onClick={refresh} disabled={priceLoading}><RefreshCw size={13} /> Refresh</button>
          <button className="btn btn-ghost" onClick={handleSaveSnapshot} title="Save today's value as a snapshot">📸 Snapshot</button>
          <button className="btn btn-primary" onClick={() => { setEditingId(null); setForm({ ticker: '', shares: '', avgCost: '', notes: '' }); setShowAdd(true) }}>
            <Plus size={14} /> Add Position
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Totals */}
        <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
          {[
            { label: 'Current Value', value: fmtUSD(totals.totalValue), color: 'accent' },
            { label: 'Total Invested', value: fmtUSD(totals.totalCost), color: 'blue' },
            { label: 'Total Return', value: fmtUSD(totals.totalGL), sub: fmtPct(totals.totalGLPct), color: isUp ? 'green' : 'red' },
            { label: 'Positions', value: positions.length, color: 'amber' }
          ].map((s, i) => (
            <div key={i} className={`stat-card ${s.color}`}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize: '1.3rem' }}>{s.value}</div>
              {s.sub && <div className="stat-change" style={{ color: isUp ? 'var(--green)' : 'var(--red)' }}>{s.sub}</div>}
            </div>
          ))}
        </div>

        {/* Charts */}
        {tickers.length > 0 && (
          <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
            {/* Price chart */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {displayTicker} Price History
                  </div>
                  {prices[displayTicker] && (
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700 }}>
                      {fmtUSD(prices[displayTicker]?.price)}
                      <span style={{ fontSize: '0.8rem', marginLeft: '0.5rem', color: (prices[displayTicker]?.changePercent || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {fmtPct(prices[displayTicker]?.changePercent)}
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {RANGES.map(r => (
                    <button key={r} onClick={() => setRange(r)} style={{
                      padding: '0.25rem 0.55rem', borderRadius: 'var(--radius-sm)',
                      border: range === r ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: range === r ? 'var(--accent-dim)' : 'transparent',
                      color: range === r ? 'var(--accent)' : 'var(--text-muted)',
                      fontSize: '0.7rem', cursor: 'pointer'
                    }}>{r}</button>
                  ))}
                </div>
              </div>
              {/* Ticker selector */}
              {tickers.length > 1 && (
                <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  {tickers.map(t => (
                    <button key={t} onClick={() => setFocusTicker(t)} style={{
                      padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem',
                      border: (focusTicker === t || (!focusTicker && t === tickers[0])) ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: (focusTicker === t || (!focusTicker && t === tickers[0])) ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                      color: (focusTicker === t || (!focusTicker && t === tickers[0])) ? 'var(--accent)' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}>{t}</button>
                  ))}
                </div>
              )}
              {loadingHist ? (
                <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading chart...</div>
              ) : (
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={histData}>
                    <defs>
                      <linearGradient id="hGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip
                      formatter={v => [fmtUSD(v), 'Price']}
                      contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}
                    />
                    <Area type="monotone" dataKey="price" stroke="var(--accent)" strokeWidth={1.5} fill="url(#hGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* P&L by position */}
            <div className="card">
              <div style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>P&L by Position</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={enriched.map(p => ({ name: p.ticker.toUpperCase(), gl: Math.round(p.gainLoss * 100) / 100 }))}>
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    formatter={v => [fmtUSD(v), 'Gain/Loss']}
                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}
                  />
                  <Bar dataKey="gl" radius={[3, 3, 0, 0]}>
                    {enriched.map((p, i) => <Cell key={i} fill={p.gainLoss >= 0 ? 'var(--green)' : 'var(--red)'} fillOpacity={0.85} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        )}

        {/* Portfolio Value Over Time */}
        {snapshots.length >= 1 && (
          <div className="card" style={{ marginTop: '0', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Portfolio Value Over Time
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, marginTop: '0.2rem' }}>
                  {fmtUSD(snapshots[snapshots.length - 1]?.value)}
                  {snapshots.length > 1 && (() => {
                    const change = snapshots[snapshots.length - 1].value - snapshots[0].value
                    const pct = (change / snapshots[0].value) * 100
                    return (
                      <span style={{ fontSize: '0.85rem', marginLeft: '0.6rem', color: change >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {change >= 0 ? '+' : ''}{fmtUSD(change)} ({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)
                      </span>
                    )
                  })()}
                </div>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{snapshots.length} data points</span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={snapshots}>
                <defs>
                  <linearGradient id="snapGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={portfolio?.color || 'var(--accent)'} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={portfolio?.color || 'var(--accent)'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip
                  formatter={v => [fmtUSD(v), 'Portfolio Value']}
                  contentStyle={{
                    background: '#ffffff', border: '1px solid #e0e0e0',
                    borderRadius: '6px', fontFamily: 'var(--font-mono)',
                    color: '#111111', fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                  itemStyle={{ color: '#111111' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={portfolio?.color || 'var(--accent)'}
                  strokeWidth={2}
                  fill="url(#snapGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Positions table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Positions</div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{positions.length} total</span>
          </div>
          {enriched.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No positions yet. Add your first position →
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Shares</th>
                    <th>Avg Cost</th>
                    <th>Current Price</th>
                    <th>Market Value</th>
                    <th>Cost Basis</th>
                    <th>Gain / Loss</th>
                    <th>Day Chg</th>
                    <th>Return %</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((pos, i) => (
                    <tr key={pos.id} style={{ animationDelay: `${i * 0.04}s` }}>
                      <td>
                        <div style={{ fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.03em' }}>{pos.ticker.toUpperCase()}</div>
                        {pos.notes && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{pos.notes}</div>}
                      </td>
                      <td>{pos.shares}</td>
                      <td>{fmtUSD(pos.avgCost)}</td>
                      <td style={{ fontWeight: 600 }}>{fmtUSD(pos.currentPrice)}</td>
                      <td style={{ fontWeight: 600 }}>{fmtUSD(pos.currentValue)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{fmtUSD(pos.costBasis)}</td>
                      <td>
                        <span style={{ color: pos.gainLoss >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                          {pos.gainLoss >= 0 ? '+' : ''}{fmtUSD(pos.gainLoss)}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: pos.dayChange >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {pos.dayChange >= 0 ? '+' : ''}{pos.dayChange.toFixed(2)}%
                        </span>
                      </td>
                      <td>
                        <span className={`tag ${pos.gainLossPct >= 0 ? 'tag-green' : 'tag-red'}`}>
                          {fmtPct(pos.gainLossPct)}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem' }} onClick={() => startEdit(pos)}><Edit2 size={12} /></button>
                          <button className="btn btn-danger" style={{ padding: '0.3rem 0.5rem' }} onClick={() => handleDelete(pos.id)}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700 }}>
                {editingId ? 'Edit Position' : 'Add Position'}
              </div>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setShowAdd(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleAddOrUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Field label="Ticker Symbol *">
                <input value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} placeholder="e.g. AAPL, MSFT, SPY" required />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Field label="Shares *">
                  <input type="number" step="any" min="0" value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))} placeholder="10.5" required />
                </Field>
                <Field label="Avg Cost / Share *">
                  <input type="number" step="any" min="0" value={form.avgCost} onChange={e => setForm(f => ({ ...f, avgCost: e.target.value }))} placeholder="150.00" required />
                </Field>
              </div>
              <Field label="Notes">
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Long-term hold, earnings play..." />
              </Field>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingId ? <><Check size={13} /> Update</> : <><Plus size={13} /> Add Position</>}
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
      <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>{label}</label>
      {children}
    </div>
  )
}
