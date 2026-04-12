// src/pages/PortfolioDetailPage.jsx
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { subscribePositions, addPosition, updatePosition, deletePosition, saveSnapshot, updatePortfolioCash } from '../lib/db'
import { useLivePrices } from '../hooks/useLivePrices'
import { fetchHistoricalData, fetchTickerNews, fetchTickerProfile, fetchTickerDescription } from '../lib/stockApi'
import { usePortfolios } from '../hooks/usePortfolios'
import { getSnapshots } from '../lib/db'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts'
import {
  ArrowLeft, Plus, Trash2, Edit2, RefreshCw, TrendingUp, TrendingDown,
  X, Check, DollarSign, ChevronUp, ChevronDown, ChevronsUpDown,
  Newspaper, Info, ExternalLink, Wallet
} from 'lucide-react'

function fmtUSD(n) {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}
function fmtPct(n) {
  if (n === undefined || isNaN(n)) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}
function timeAgo(date) {
  if (!date) return ''
  const diff = Date.now() - date.getTime()
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (h < 1) return 'Just now'
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

const RANGES = ['1w', '1m', '3m', '6m', '1y']

// Sortable columns config
const SORT_COLS = [
  { key: 'ticker',       label: 'Ticker' },
  { key: 'shares',       label: 'Shares' },
  { key: 'avgCost',      label: 'Avg Cost' },
  { key: 'currentPrice', label: 'Price' },
  { key: 'currentValue', label: 'Mkt Value' },
  { key: 'costBasis',    label: 'Cost Basis' },
  { key: 'gainLoss',     label: 'Gain/Loss' },
  { key: 'dayChange',    label: 'Day Chg' },
  { key: 'gainLossPct',  label: 'Return %' },
]

function SortIcon({ col, sortBy, sortDir }) {
  if (sortBy !== col) return <ChevronsUpDown size={11} style={{ opacity: 0.3 }} />
  return sortDir === 'asc' ? <ChevronUp size={11} color="var(--accent)" /> : <ChevronDown size={11} color="var(--accent)" />
}

export default function PortfolioDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { portfolios, loading: portLoading } = usePortfolios()
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

  // Sorting
  const [sortBy, setSortBy] = useState('currentValue')
  const [sortDir, setSortDir] = useState('desc')

  // Cash management
  const [cashInput, setCashInput] = useState('')
  const [showCashEditor, setShowCashEditor] = useState(false)
  const [cashMode, setCashMode] = useState('set') // 'set' | 'add' | 'sell'
  const [sellForm, setSellForm] = useState({ ticker: '', shares: '', price: '' })
  const [savingCash, setSavingCash] = useState(false)

  // News panel
  const [newsPanel, setNewsPanel] = useState(null) // ticker or null
  const [news, setNews] = useState([])
  const [newsLoading, setNewsLoading] = useState(false)

  // Descriptions panel
  const [descPanel, setDescPanel] = useState(null) // ticker or null
  const [profiles, setProfiles] = useState({}) // ticker -> profile
  const [aiDesc, setAiDesc] = useState({}) // ticker -> { description, sector, industry, ... }
  const [descLoading, setDescLoading] = useState(false)

  useEffect(() => {
    const unsub = subscribePositions(id, data => setPositions(data))
    return unsub
  }, [id])

  const tickers = useMemo(() => [...new Set(positions.map(p => p.ticker.toUpperCase()))], [positions])
  const { prices, loading: priceLoading, lastUpdated, refresh } = useLivePrices(tickers)

  useEffect(() => {
    getSnapshots(id).then(data => {
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

  // Sorted enriched positions
  const sortedEnriched = useMemo(() => {
    return [...enriched].sort((a, b) => {
      let av = a[sortBy], bv = b[sortBy]
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av === undefined) av = 0
      if (bv === undefined) bv = 0
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
  }, [enriched, sortBy, sortDir])

  const totals = useMemo(() => {
    const totalValue = enriched.reduce((s, p) => s + p.currentValue, 0)
    const totalCost = enriched.reduce((s, p) => s + p.costBasis, 0)
    const totalGL = totalValue - totalCost
    const totalGLPct = totalCost > 0 ? (totalGL / totalCost) * 100 : 0
    const cash = portfolio?.cash || 0
    const totalWithCash = totalValue + cash
    return { totalValue, totalCost, totalGL, totalGLPct, cash, totalWithCash }
  }, [enriched, portfolio])

  useEffect(() => {
    if (!tickers.length || !Object.keys(prices).length) return
    const totalValue = enriched.reduce((s, p) => s + p.currentValue, 0)
    if (totalValue > 0) saveSnapshot(id, user.uid, totalValue)
  }, [lastUpdated])

  useEffect(() => {
    const ticker = focusTicker || tickers[0]
    if (!ticker) return
    setLoadingHist(true)
    fetchHistoricalData(ticker, range).then(d => { setHistData(d); setLoadingHist(false) })
  }, [focusTicker, range, tickers.join(',')])

  // Handle sort column click
  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  // Cash management
  const handleCashSave = async () => {
    setSavingCash(true)
    try {
      let newCash = portfolio?.cash || 0
      if (cashMode === 'set') newCash = parseFloat(cashInput) || 0
      else if (cashMode === 'add') newCash = newCash + (parseFloat(cashInput) || 0)
      else if (cashMode === 'sell') {
        const proceeds = (parseFloat(sellForm.shares) || 0) * (parseFloat(sellForm.price) || 0)
        newCash = newCash + proceeds
      }
      await updatePortfolioCash(id, newCash)
      setShowCashEditor(false)
      setCashInput('')
      setSellForm({ ticker: '', shares: '', price: '' })
    } finally {
      setSavingCash(false)
    }
  }

  // News panel
  const openNews = async (ticker) => {
    if (newsPanel === ticker) { setNewsPanel(null); return }
    setNewsPanel(ticker)
    setDescPanel(null)
    setNewsLoading(true)
    const data = await fetchTickerNews(ticker)
    setNews(data)
    setNewsLoading(false)
  }

  // Description panel
  const openDesc = async (ticker) => {
    if (descPanel === ticker) { setDescPanel(null); return }
    setDescPanel(ticker)
    setNewsPanel(null)

    const needsProfile = !profiles[ticker]
    const needsDesc = !aiDesc[ticker]

    if (needsProfile || needsDesc) {
      setDescLoading(true)
      try {
        const [profile, descData] = await Promise.all([
          needsProfile ? fetchTickerProfile(ticker) : Promise.resolve(profiles[ticker]),
          needsDesc    ? fetchTickerDescription(ticker) : Promise.resolve(aiDesc[ticker]),
        ])
        if (needsProfile) setProfiles(p => ({ ...p, [ticker]: profile }))
        if (needsDesc)    setAiDesc(d => ({ ...d, [ticker]: descData }))
      } catch {
        setAiDesc(d => ({ ...d, [ticker]: null }))
      } finally {
        setDescLoading(false)
      }
    }
  }

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
  const cash = portfolio?.cash || 0

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
          <button className="btn btn-ghost" onClick={() => { setShowCashEditor(true); setCashMode('set'); setCashInput(String(cash)) }} style={{ color: 'var(--green)', borderColor: 'rgba(0,200,150,0.3)' }}>
            <Wallet size={13} /> Cash
          </button>
          <button className="btn btn-primary" onClick={() => { setEditingId(null); setForm({ ticker: '', shares: '', avgCost: '', notes: '' }); setShowAdd(true) }}>
            <Plus size={14} /> Add Position
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Totals — now includes cash */}
        <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
          {[
            { label: 'Invested Value', value: fmtUSD(totals.totalValue), color: 'accent' },
            { label: 'Cash Balance', value: fmtUSD(cash), color: 'green', action: () => { setShowCashEditor(true); setCashMode('set'); setCashInput(String(cash)) } },
            { label: 'Total Return', value: fmtUSD(totals.totalGL), sub: fmtPct(totals.totalGLPct), color: isUp ? 'green' : 'red' },
            { label: 'Positions', value: positions.length, color: 'amber' }
          ].map((s, i) => (
            <div key={i} className={`stat-card ${s.color}`} onClick={s.action} style={{ cursor: s.action ? 'pointer' : 'default' }}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize: '1.3rem' }}>{s.value}</div>
              {s.sub && <div className="stat-change" style={{ color: isUp ? 'var(--green)' : 'var(--red)' }}>{s.sub}</div>}
              {i === 1 && <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Click to update</div>}
            </div>
          ))}
        </div>

        {/* Total Portfolio Value (equity + cash) */}
        {cash > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', padding: '0.75rem 1.25rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <DollarSign size={14} color="var(--accent)" />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Portfolio (equity + cash):</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>{fmtUSD(totals.totalWithCash)}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {((totals.totalValue / totals.totalWithCash) * 100).toFixed(1)}% invested · {((cash / totals.totalWithCash) * 100).toFixed(1)}% cash
            </span>
          </div>
        )}

        {/* Charts */}
        {tickers.length > 0 && (
          <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
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
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Portfolio Value Over Time</div>
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
                  contentStyle={{ background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: '6px', fontFamily: 'var(--font-mono)', color: '#111111', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                  itemStyle={{ color: '#111111' }}
                />
                <Area type="monotone" dataKey="value" stroke={portfolio?.color || 'var(--accent)'} strokeWidth={2} fill="url(#snapGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Positions table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Positions</div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Sort by column header</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{positions.length} total</span>
            </div>
          </div>

          {sortedEnriched.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No positions yet. Add your first position →</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {SORT_COLS.map(col => (
                      <th key={col.key} onClick={() => handleSort(col.key)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: sortBy === col.key ? 'var(--accent)' : undefined }}>
                          {col.label}
                          <SortIcon col={col.key} sortBy={sortBy} sortDir={sortDir} />
                        </span>
                      </th>
                    ))}
                    <th style={{ width: 100 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEnriched.map((pos, i) => (
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
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '0.3rem 0.45rem' }}
                            onClick={() => openDesc(pos.ticker.toUpperCase())}
                            title="Company description"
                          >
                            <Info size={12} />
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '0.3rem 0.45rem' }}
                            onClick={() => openNews(pos.ticker.toUpperCase())}
                            title="Latest news"
                          >
                            <Newspaper size={12} />
                          </button>
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

        {/* Description panel */}
        {descPanel && (
          <div className="card" style={{ marginTop: '1rem', animation: 'fadeIn 0.25s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Info size={15} color="var(--blue)" />
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{descPanel}</span>
                {profiles[descPanel] && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {profiles[descPanel].name}
                    {profiles[descPanel].type && (
                      <span className={`tag ${profiles[descPanel].type === 'ETF' || profiles[descPanel].type === 'MUTUALFUND' ? 'tag-blue' : 'tag-accent'}`} style={{ marginLeft: '0.4rem', fontSize: '0.62rem' }}>
                        {profiles[descPanel].type === 'MUTUALFUND' ? 'Fund' : profiles[descPanel].type}
                      </span>
                    )}
                    {profiles[descPanel].sector && <span style={{ marginLeft: '0.35rem' }}>· {profiles[descPanel].sector}</span>}
                  </span>
                )}
              </div>
              <button className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem' }} onClick={() => setDescPanel(null)}><X size={14} /></button>
            </div>
            {descLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[100, 85, 90, 70].map((w, i) => (
                  <div key={i} style={{ height: 12, borderRadius: 4, background: 'var(--bg-elevated)', width: `${w}%`, animation: `pulse 1.5s ${i * 0.15}s infinite` }} />
                ))}
              </div>
            ) : aiDesc[descPanel] ? (
              <div>
                {(aiDesc[descPanel].sector || aiDesc[descPanel].industry || aiDesc[descPanel].country || aiDesc[descPanel].employees || aiDesc[descPanel].website) && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                    {aiDesc[descPanel].sector   && <span className="tag tag-blue">{aiDesc[descPanel].sector}</span>}
                    {aiDesc[descPanel].industry && <span className="tag tag-accent">{aiDesc[descPanel].industry}</span>}
                    {aiDesc[descPanel].country  && <span className="tag" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>{aiDesc[descPanel].country}</span>}
                    {aiDesc[descPanel].employees && <span className="tag" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>{aiDesc[descPanel].employees.toLocaleString()} employees</span>}
                    {aiDesc[descPanel].website  && (
                      <a href={aiDesc[descPanel].website} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: 'var(--accent)', textDecoration: 'none' }}>
                        <ExternalLink size={10} /> {aiDesc[descPanel].website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    {aiDesc[descPanel].wikiUrl && (
                      <a href={aiDesc[descPanel].wikiUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
                        <ExternalLink size={10} /> Wikipedia
                      </a>
                    )}
                  </div>
                )}
                <div style={{ fontSize: '0.83rem', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                  {aiDesc[descPanel].description}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem' }}>
                No description available for {descPanel}
              </div>
            )}
          </div>
        )}

        {/* News panel */}
        {newsPanel && (
          <div className="card" style={{ marginTop: '1rem', animation: 'fadeIn 0.25s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Newspaper size={15} color="var(--accent)" />
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Latest News · {newsPanel}</span>
              </div>
              <button className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem' }} onClick={() => setNewsPanel(null)}><X size={14} /></button>
            </div>
            {newsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div style={{ width: 60, height: 40, borderRadius: 6, background: 'var(--bg-elevated)', flexShrink: 0, animation: 'pulse 1.5s infinite' }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{ height: 12, borderRadius: 4, background: 'var(--bg-elevated)', animation: 'pulse 1.5s infinite' }} />
                      <div style={{ height: 10, borderRadius: 4, background: 'var(--bg-elevated)', width: '60%', animation: 'pulse 1.5s infinite' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : news.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '1.5rem' }}>No news found for {newsPanel}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {news.map((item, i) => (
                  <a
                    key={item.uuid || i}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                      padding: '0.75rem 0',
                      borderBottom: i < news.length - 1 ? '1px solid var(--border)' : 'none',
                      textDecoration: 'none',
                      transition: 'background 0.15s',
                      borderRadius: 'var(--radius-sm)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {item.thumbnail && (
                      <img src={item.thumbnail} alt="" style={{ width: 64, height: 42, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: '0.25rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                        <span style={{ flex: 1 }}>{item.title}</span>
                        <ExternalLink size={11} color="var(--text-dim)" style={{ flexShrink: 0, marginTop: 3 }} />
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {item.publisher} · {timeAgo(item.publishedAt)}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cash Editor Modal */}
      {showCashEditor && (
        <div className="modal-overlay" onClick={() => setShowCashEditor(false)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Wallet size={18} color="var(--green)" /> Cash Balance
              </div>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setShowCashEditor(false)}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1.25rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '3px' }}>
              {[
                { id: 'set', label: 'Set Balance' },
                { id: 'add', label: 'Deposit/Withdraw' },
                { id: 'sell', label: 'Record Sale' },
              ].map(m => (
                <button key={m.id} onClick={() => setCashMode(m.id)} style={{
                  flex: 1, padding: '0.45rem 0.5rem', borderRadius: '3px', border: 'none',
                  fontSize: '0.72rem', fontFamily: 'var(--font-mono)',
                  background: cashMode === m.id ? 'var(--bg-surface)' : 'transparent',
                  color: cashMode === m.id ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}>{m.label}</button>
              ))}
            </div>

            <div style={{ marginBottom: '1rem', padding: '0.6rem 0.75rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Current cash: <strong style={{ color: 'var(--green)' }}>{fmtUSD(cash)}</strong>
            </div>

            {cashMode === 'set' && (
              <Field label="New Cash Balance">
                <input type="number" step="0.01" value={cashInput} onChange={e => setCashInput(e.target.value)} placeholder="5000.00" autoFocus />
              </Field>
            )}

            {cashMode === 'add' && (
              <Field label="Amount (positive = deposit, negative = withdrawal)">
                <input type="number" step="0.01" value={cashInput} onChange={e => setCashInput(e.target.value)} placeholder="1000.00 or -500.00" autoFocus />
                {cashInput && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    New balance: <strong style={{ color: 'var(--green)' }}>{fmtUSD(cash + (parseFloat(cashInput) || 0))}</strong>
                  </div>
                )}
              </Field>
            )}

            {cashMode === 'sell' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Selling a position? Enter details and the proceeds will be added to cash automatically.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
                  <Field label="Ticker">
                    <input value={sellForm.ticker} onChange={e => setSellForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} placeholder="AAPL" />
                  </Field>
                  <Field label="Shares Sold">
                    <input type="number" step="any" value={sellForm.shares} onChange={e => setSellForm(f => ({ ...f, shares: e.target.value }))} placeholder="10" />
                  </Field>
                  <Field label="Sell Price">
                    <input type="number" step="any" value={sellForm.price} onChange={e => setSellForm(f => ({ ...f, price: e.target.value }))} placeholder="175.00" />
                  </Field>
                </div>
                {sellForm.shares && sellForm.price && (
                  <div style={{ padding: '0.6rem 0.75rem', background: 'var(--green-dim)', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--green)' }}>
                    Proceeds: {fmtUSD(parseFloat(sellForm.shares) * parseFloat(sellForm.price))} → New cash: {fmtUSD(cash + parseFloat(sellForm.shares) * parseFloat(sellForm.price))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button className="btn btn-ghost" onClick={() => setShowCashEditor(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCashSave} disabled={savingCash} style={{ background: 'var(--green)', color: '#000' }}>
                {savingCash ? 'Saving...' : <><Check size={13} /> Update Cash</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Position Modal */}
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