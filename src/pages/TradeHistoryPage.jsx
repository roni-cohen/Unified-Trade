// src/pages/TradeHistoryPage.jsx
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../lib/AuthContext'
import { subscribeTradeHistory } from '../lib/db'
import { usePortfolios } from '../hooks/usePortfolios'
import { History, TrendingUp, TrendingDown, DollarSign, BarChart2, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

function fmtUSD(n) {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}
function fmtPct(n) {
  if (n === undefined || isNaN(n)) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}
function fmtDate(trade) {
  const d = trade.closedDate || (trade.closedAt?.seconds ? new Date(trade.closedAt.seconds * 1000).toISOString().split('T')[0] : null)
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function SortIcon({ col, sortBy, sortDir }) {
  if (sortBy !== col) return <ChevronsUpDown size={11} style={{ opacity: 0.3 }} />
  return sortDir === 'asc' ? <ChevronUp size={11} color="var(--accent)" /> : <ChevronDown size={11} color="var(--accent)" />
}

const COLS = [
  { key: 'closedDate',    label: 'Date' },
  { key: 'ticker',        label: 'Ticker' },
  { key: 'portfolioName', label: 'Portfolio' },
  { key: 'type',          label: 'Type' },
  { key: 'shares',        label: 'Shares' },
  { key: 'avgCost',       label: 'Avg Cost' },
  { key: 'sellPrice',     label: 'Sell Price' },
  { key: 'proceeds',      label: 'Proceeds' },
  { key: 'pnl',           label: 'P&L ($)' },
  { key: 'pnlPct',        label: 'P&L (%)' },
]

export default function TradeHistoryPage() {
  const { user } = useAuth()
  const { portfolios } = usePortfolios()
  const [trades, setTrades] = useState([])
  const [filterTicker, setFilterTicker] = useState('')
  const [filterPortfolio, setFilterPortfolio] = useState('')
  const [sortBy, setSortBy] = useState('closedDate')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    const unsub = subscribeTradeHistory(user.uid, data => setTrades(data))
    return unsub
  }, [user.uid])

  const filtered = useMemo(() => {
    return trades.filter(t => {
      if (filterTicker && !t.ticker?.toUpperCase().includes(filterTicker.toUpperCase())) return false
      if (filterPortfolio && t.portfolioId !== filterPortfolio) return false
      return true
    })
  }, [trades, filterTicker, filterPortfolio])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av = a[sortBy], bv = b[sortBy]
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av === undefined || av === null) av = sortDir === 'asc' ? Infinity : -Infinity
      if (bv === undefined || bv === null) bv = sortDir === 'asc' ? Infinity : -Infinity
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
  }, [filtered, sortBy, sortDir])

  const stats = useMemo(() => {
    const wins = trades.filter(t => t.pnl > 0).length
    const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0)
    const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0
    return { total: trades.length, wins, winRate, totalPnl }
  }, [trades])

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">
            <History size={18} color="var(--accent)" />
            Trade History
          </div>
          <div className="page-subtitle">{stats.total} closed trade{stats.total !== 1 ? 's' : ''} across all portfolios</div>
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card accent">
            <div className="stat-label">Total Trades</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-card green">
            <div className="stat-label">Win Rate</div>
            <div className="stat-value">{stats.winRate.toFixed(1)}%</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{stats.wins} winning</div>
          </div>
          <div className={`stat-card ${stats.totalPnl >= 0 ? 'green' : 'red'}`}>
            <div className="stat-label">Total Realized P&L</div>
            <div className="stat-value" style={{ fontSize: '1.2rem' }}>{fmtUSD(stats.totalPnl)}</div>
          </div>
          <div className="stat-card amber">
            <div className="stat-label">Avg P&L / Trade</div>
            <div className="stat-value" style={{ fontSize: '1.2rem' }}>
              {stats.total > 0 ? fmtUSD(stats.totalPnl / stats.total) : '—'}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder="Filter by ticker…"
            value={filterTicker}
            onChange={e => setFilterTicker(e.target.value)}
            style={{ padding: '0.45rem 0.75rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem', width: 180 }}
          />
          <select
            value={filterPortfolio}
            onChange={e => setFilterPortfolio(e.target.value)}
            style={{ padding: '0.45rem 0.75rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
          >
            <option value="">All portfolios</option>
            {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {(filterTicker || filterPortfolio) && (
            <button className="btn btn-ghost" onClick={() => { setFilterTicker(''); setFilterPortfolio('') }} style={{ fontSize: '0.75rem' }}>
              Clear filters
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {sorted.length} of {trades.length} trades
          </span>
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {sorted.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {trades.length === 0
                ? 'No closed trades yet. Use the "End Position" button on any holding to record a sale.'
                : 'No trades match your filters.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {COLS.map(col => (
                      <th key={col.key} onClick={() => handleSort(col.key)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: sortBy === col.key ? 'var(--accent)' : undefined }}>
                          {col.label}
                          <SortIcon col={col.key} sortBy={sortBy} sortDir={sortDir} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((trade, i) => (
                    <tr key={trade.id} style={{ animationDelay: `${i * 0.03}s` }}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{fmtDate(trade)}</td>
                      <td>
                        <span style={{ fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.03em' }}>{trade.ticker}</span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{trade.portfolioName || '—'}</td>
                      <td>
                        <span className={`tag ${trade.type === 'full' ? 'tag-accent' : 'tag-blue'}`}>
                          {trade.type === 'full' ? 'Full' : 'Partial'}
                        </span>
                      </td>
                      <td>{trade.shares}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{fmtUSD(trade.avgCost)}</td>
                      <td style={{ fontWeight: 600 }}>{fmtUSD(trade.sellPrice)}</td>
                      <td style={{ fontWeight: 600 }}>{fmtUSD(trade.proceeds)}</td>
                      <td>
                        <span style={{ color: trade.pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                          {trade.pnl >= 0 ? '+' : ''}{fmtUSD(trade.pnl)}
                        </span>
                      </td>
                      <td>
                        <span className={`tag ${trade.pnlPct >= 0 ? 'tag-green' : 'tag-red'}`}>
                          {fmtPct(trade.pnlPct)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
