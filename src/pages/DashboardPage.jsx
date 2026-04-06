// src/pages/DashboardPage.jsx
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { usePortfolios } from '../hooks/usePortfolios'
import { subscribePositions } from '../lib/db'
import { useLivePrices } from '../hooks/useLivePrices'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, BarChart2, RefreshCw, Circle } from 'lucide-react'
import { format } from 'date-fns'

const COLORS = ['#00d4aa','#3d8ef0','#f5a623','#ff4d6d','#a78bfa','#34d399','#fb923c']

function fmtUSD(n) {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}
function fmtPct(n) {
  if (n === undefined || isNaN(n)) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e0e0e0',
      borderRadius: '6px',
      padding: '8px 12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
    }}>
      <div style={{ fontSize: '11px', color: '#666666', marginBottom: '4px' }}>{label}</div>
      <div style={{ color: '#00a87a', fontWeight: 600, fontSize: '13px' }}>{fmtUSD(payload[0]?.value)}</div>
    </div>
  )
}
export default function DashboardPage() {
  const { user } = useAuth()
  const { portfolios, loading: portLoading } = usePortfolios()
  const navigate = useNavigate()

  // Collect all positions across all portfolios
  const [allPositions, setAllPositions] = useState([])

  useEffect(() => {
    if (!portfolios.length) { setAllPositions([]); return }
    const unsubs = []
    const byPortfolio = {}

    portfolios.forEach(p => {
      const unsub = subscribePositions(p.id, positions => {
        byPortfolio[p.id] = positions
        setAllPositions(Object.values(byPortfolio).flat())
      })
      unsubs.push(unsub)
    })
    return () => unsubs.forEach(u => u())
  }, [portfolios.map(p => p.id).join(',')])

  const tickers = useMemo(() => [...new Set(allPositions.map(p => p.ticker.toUpperCase()))], [allPositions])
  const { prices, loading: priceLoading, lastUpdated, refresh } = useLivePrices(tickers)

  // Compute totals
  const stats = useMemo(() => {
    let totalValue = 0, totalCost = 0

    const enriched = allPositions.map(pos => {
      const price = prices[pos.ticker.toUpperCase()]?.price
      const currentValue = price ? price * pos.shares : pos.avgCost * pos.shares
      const costBasis = pos.avgCost * pos.shares
      const gainLoss = currentValue - costBasis
      const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0
      totalValue += currentValue
      totalCost += costBasis
      return { ...pos, currentValue, costBasis, gainLoss, gainLossPct, currentPrice: price }
    })

    const totalGainLoss = totalValue - totalCost
    const totalGainLossPct = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0

    // Allocation by portfolio
    const byPortfolio = {}
    portfolios.forEach(p => { byPortfolio[p.id] = { name: p.name, value: 0 } })
    enriched.forEach(pos => {
      if (byPortfolio[pos.portfolioId]) byPortfolio[pos.portfolioId].value += pos.currentValue
    })

    // Top movers (by % gain today)
    const movers = enriched
      .map(p => ({ ...p, dayChange: prices[p.ticker.toUpperCase()]?.changePercent || 0 }))
      .sort((a, b) => Math.abs(b.dayChange) - Math.abs(a.dayChange))
      .slice(0, 5)

    return {
      totalValue, totalCost, totalGainLoss, totalGainLossPct,
      allocationData: Object.values(byPortfolio).filter(d => d.value > 0),
      movers,
      positionCount: enriched.length
    }
  }, [allPositions, prices, portfolios])

  // Sparkline data — simulated from cost basis to current
  const sparkData = useMemo(() => {
    const points = []
    const base = stats.totalCost || 10000
    const now = stats.totalValue || base
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const ratio = 1 + ((now - base) / base) * ((6 - i) / 6) * (0.8 + Math.random() * 0.4)
      points.push({ date: format(d, 'MMM d'), value: Math.round(base * ratio) })
    }
    points[points.length - 1].value = Math.round(now)
    return points
  }, [stats.totalCost, stats.totalValue])

  const isUp = stats.totalGainLoss >= 0

  if (portLoading) return <LoadingScreen />

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">
            <BarChart2 size={18} color="var(--accent)" />
            Dashboard
          </div>
          <div className="page-subtitle">
            {portfolios.length} portfolio{portfolios.length !== 1 ? 's' : ''} · {stats.positionCount} position{stats.positionCount !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
          {lastUpdated && (
            <span style={{ fontSize:'0.68rem', color:'var(--text-muted)' }}>
              Updated {format(lastUpdated, 'HH:mm:ss')}
            </span>
          )}
          <button className="btn btn-ghost" onClick={refresh} disabled={priceLoading} style={{ gap:'0.4rem' }}>
            <RefreshCw size={13} style={{ animation: priceLoading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Stat cards */}
        <div className="grid-4" style={{ marginBottom:'1.5rem' }}>
          <StatCard label="Total Portfolio Value" value={fmtUSD(stats.totalValue)} color="accent" icon={<DollarSign size={14} />} />
          <StatCard label="Total Invested" value={fmtUSD(stats.totalCost)} color="blue" icon={<DollarSign size={14} />} />
          <StatCard
            label="Total Return"
            value={fmtUSD(stats.totalGainLoss)}
            sub={fmtPct(stats.totalGainLossPct)}
            color={isUp ? 'green' : 'red'}
            icon={isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            positive={isUp}
          />
          <StatCard label="Open Positions" value={stats.positionCount} color="amber" icon={<BarChart2 size={14} />} />
        </div>

        {/* Charts row */}
        <div className="grid-2" style={{ marginBottom:'1.5rem' }}>
          {/* Value chart */}
          <div className="card" style={{ gridColumn: '1 / 2' }}>
            <div style={{ fontSize:'0.65rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'0.25rem' }}>Portfolio Value Trend</div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'1.3rem', fontWeight:700, marginBottom:'1rem' }}>
              {fmtUSD(stats.totalValue)}
              <span style={{ fontSize:'0.8rem', marginLeft:'0.5rem', color: isUp ? 'var(--green)' : 'var(--red)' }}>
                {fmtPct(stats.totalGainLossPct)}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={sparkData}>
                <defs>
                  <linearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isUp ? '#00c896' : '#ff4d6d'} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={isUp ? '#00c896' : '#ff4d6d'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill:'var(--text-muted)', fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={isUp ? 'var(--green)' : 'var(--red)'}
                  strokeWidth={2}
                  fill="url(#vGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Allocation pie */}
          <div className="card">
            <div style={{ fontSize:'0.65rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'1rem' }}>Allocation by Portfolio</div>
            {stats.allocationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie
                    data={stats.allocationData}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {stats.allocationData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend
                    formatter={(value, entry) => (
                      <span style={{ color:'var(--text-secondary)', fontSize:'0.75rem' }}>
                        {entry.payload.name} <span style={{ color:'var(--text-muted)' }}>({fmtUSD(entry.payload.value)})</span>
                      </span>
                    )}
                  />
                  <Tooltip
                    formatter={(v, n, props) => [fmtUSD(v), props.payload.name]}
                    contentStyle={{
                      background: '#ffffff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '6px',
                      fontFamily: 'var(--font-mono)',
                      color: '#111111',
                      fontSize: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                    itemStyle={{ color: '#111111' }}
                    labelStyle={{ color: '#444444' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState msg="Add positions to see allocation" />
            )}
          </div>
        </div>

        {/* Top movers + Portfolios */}
        <div className="grid-2">
          {/* Top movers */}
          <div className="card">
            <div style={{ fontSize:'0.65rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'1rem' }}>Top Movers Today</div>
            {stats.movers.length > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
                {stats.movers.map((pos, i) => {
                  const d = pos.dayChange
                  return (
                    <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.5rem 0.75rem', background:'var(--bg-elevated)', borderRadius:'var(--radius-sm)', animation:`fadeIn ${0.3 + i * 0.08}s ease` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
                        <Circle size={6} fill={d >= 0 ? 'var(--green)' : 'var(--red)'} stroke="none" />
                        <span style={{ fontWeight:600, color:'var(--text-primary)' }}>{pos.ticker.toUpperCase()}</span>
                        <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{pos.shares} sh</span>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:'0.82rem', fontWeight:600, color: d >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {d >= 0 ? '+' : ''}{d.toFixed(2)}%
                        </div>
                        <div style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>{fmtUSD(pos.currentPrice)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState msg="No positions to show" />
            )}
          </div>

          {/* Portfolios list */}
          <div className="card">
            <div style={{ fontSize:'0.65rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'1rem' }}>Your Portfolios</div>
            {portfolios.length > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {portfolios.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/portfolios/${p.id}`)}
                    style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'0.65rem 0.75rem',
                      background:'var(--bg-elevated)',
                      border:'1px solid var(--border)',
                      borderRadius:'var(--radius-sm)',
                      cursor:'pointer', width:'100%',
                      transition:'all 0.15s',
                      animation:`fadeIn ${0.3 + i * 0.08}s ease`
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-elevated)' }}
                  >
                    <div style={{ display:'flex', alignItems:'center', gap:'0.65rem' }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background: COLORS[i % COLORS.length] }} />
                      <span style={{ fontFamily:'var(--font-display)', fontWeight:600, color:'var(--text-primary)' }}>{p.name}</span>
                    </div>
                    <span style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>→</span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState msg="No portfolios yet — create one in Portfolios" />
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function StatCard({ label, value, sub, color, icon, positive }) {
  return (
    <div className={`stat-card ${color}`}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.5rem' }}>
        <div className="stat-label">{label}</div>
        <span style={{ color:`var(--${color === 'accent' ? 'accent' : color === 'green' ? 'green' : color === 'red' ? 'red' : color === 'blue' ? 'blue' : 'amber'})`, opacity:0.7 }}>{icon}</span>
      </div>
      <div className="stat-value">{value}</div>
      {sub && (
        <div className="stat-change" style={{ color: positive ? 'var(--green)' : 'var(--red)' }}>
          {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {sub}
        </div>
      )}
    </div>
  )
}

function EmptyState({ msg }) {
  return (
    <div style={{ textAlign:'center', padding:'2rem 1rem', color:'var(--text-muted)', fontSize:'0.8rem' }}>
      {msg}
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', minHeight:'400px', color:'var(--text-muted)', fontFamily:'var(--font-mono)', fontSize:'0.8rem', gap:'0.5rem' }}>
      <RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }} />
      Loading...
    </div>
  )
}
