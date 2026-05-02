// src/pages/InsightsPage.jsx
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../lib/AuthContext'
import { usePortfolios } from '../hooks/usePortfolios'
import { subscribePositions, subscribeJournal } from '../lib/db'
import { useLivePrices } from '../hooks/useLivePrices'
import { Lightbulb, Sparkles, RefreshCw, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, XCircle, ChevronRight } from 'lucide-react'

function fmtUSD(n) {
  if (!n && n !== 0) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}
function fmtPct(n) {
  if (n === undefined || isNaN(n)) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

export default function InsightsPage() {
  const { user } = useAuth()
  const { portfolios } = usePortfolios()
  const [allPositions, setAllPositions] = useState([])
  const [journalEntries, setJournalEntries] = useState([])
  const [aiInsight, setAiInsight] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [activeSection, setActiveSection] = useState('overview')

  useEffect(() => {
    if (!portfolios.length || !user) return
    const byPort = {}
    const unsubs = portfolios.map(p => subscribePositions(p.id, user.uid, positions => {
      byPort[p.id] = positions
      setAllPositions(Object.values(byPort).flat())
    }))
    return () => unsubs.forEach(u => u())
  }, [portfolios.map(p => p.id).join(','), user?.uid])

  useEffect(() => {
    if (!user) return
    return subscribeJournal(user.uid, setJournalEntries)
  }, [user])

  const tickers = useMemo(() => [...new Set(allPositions.map(p => p.ticker.toUpperCase()))], [allPositions])
  const { prices } = useLivePrices(tickers)

  const enriched = useMemo(() => allPositions.map(pos => {
    const pd = prices[pos.ticker.toUpperCase()]
    const currentPrice = pd?.price ?? pos.avgCost
    const currentValue = currentPrice * pos.shares
    const costBasis = pos.avgCost * pos.shares
    const gainLoss = currentValue - costBasis
    const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0
    const dayChange = pd?.changePercent ?? 0
    const portName = portfolios.find(p => p.id === pos.portfolioId)?.name || 'Unknown'
    return { ...pos, currentPrice, currentValue, costBasis, gainLoss, gainLossPct, dayChange, portName }
  }), [allPositions, prices, portfolios])

  const totalValue = enriched.reduce((s, p) => s + p.currentValue, 0)
  const totalCost = enriched.reduce((s, p) => s + p.costBasis, 0)
  const totalGL = totalValue - totalCost
  const totalGLPct = totalCost > 0 ? (totalGL / totalCost) * 100 : 0

  const winners = [...enriched].sort((a, b) => b.gainLossPct - a.gainLossPct).slice(0, 5)
  const losers = [...enriched].sort((a, b) => a.gainLossPct - b.gainLossPct).slice(0, 5)

  // Concentration risk
  const concentration = enriched.map(p => ({ ticker: p.ticker.toUpperCase(), pct: totalValue > 0 ? (p.currentValue / totalValue) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct)

  // Journal analytics
  const wins = journalEntries.filter(e => e.outcome === 'win')
  const losses = journalEntries.filter(e => e.outcome === 'loss')
  const winRate = (wins.length + losses.length) > 0 ? Math.round((wins.length / (wins.length + losses.length)) * 100) : 0
  const avgWin = wins.length > 0 ? wins.reduce((s, e) => s + (e.pnl || 0), 0) / wins.length : 0
  const avgLoss = losses.length > 0 ? losses.reduce((s, e) => s + (e.pnl || 0), 0) / losses.length : 0
  const rr = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0

  // Strategy breakdown
  const stratMap = {}
  journalEntries.forEach(e => {
    if (!e.strategy) return
    if (!stratMap[e.strategy]) stratMap[e.strategy] = { wins: 0, losses: 0, pnl: 0 }
    if (e.outcome === 'win') stratMap[e.strategy].wins++
    if (e.outcome === 'loss') stratMap[e.strategy].losses++
    stratMap[e.strategy].pnl += (e.pnl || 0)
  })
  const strategies = Object.entries(stratMap).map(([name, s]) => ({
    name, ...s,
    wr: (s.wins + s.losses) > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0
  })).sort((a, b) => b.pnl - a.pnl)

  // Alerts
  const alerts = []
  concentration.filter(c => c.pct > 20).forEach(c => {
    alerts.push({ type: 'warning', msg: `${c.ticker} is ${c.pct.toFixed(1)}% of your portfolio — high concentration risk` })
  })
  enriched.filter(p => p.gainLossPct < -15).forEach(p => {
    alerts.push({ type: 'danger', msg: `${p.ticker.toUpperCase()} is down ${Math.abs(p.gainLossPct).toFixed(1)}% — consider reviewing your thesis` })
  })
  if (winRate < 40 && (wins.length + losses.length) >= 5) {
    alerts.push({ type: 'warning', msg: `Win rate is ${winRate}% — review your entry criteria and strategy` })
  }
  if (rr < 1 && (wins.length + losses.length) >= 3) {
    alerts.push({ type: 'warning', msg: `Risk/Reward ratio is ${rr.toFixed(2)} — you're losing more than you're winning per trade` })
  }
  winners.slice(0, 1).forEach(p => {
    if (p.gainLossPct > 50) alerts.push({ type: 'success', msg: `${p.ticker.toUpperCase()} is up ${p.gainLossPct.toFixed(1)}% — consider taking some profits` })
  })

  // AI Insights
  const generateAIInsight = async () => {
    setAiLoading(true)
    setAiError('')
    setAiInsight('')
    try {
      const portfolioSummary = {
        totalValue, totalCost, totalGainLoss: totalGL, totalReturn: totalGLPct,
        positions: enriched.map(p => ({
          ticker: p.ticker.toUpperCase(),
          portfolio: p.portName,
          shares: p.shares,
          avgCost: p.avgCost,
          currentPrice: p.currentPrice,
          gainLossPct: p.gainLossPct,
          dayChange: p.dayChange,
          currentValue: p.currentValue
        })),
        journalStats: { winRate, avgWin, avgLoss, rr, totalTrades: journalEntries.length },
        strategies,
        concentration: concentration.slice(0, 5)
      }

      const res = await fetch('/api/anthropic/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `You are a professional portfolio analyst and trading coach. Analyze this trader's portfolio data and provide actionable, specific insights. Be direct, honest, and practical. Format your response with clear sections using these exact markdown-style headers: ## What's Working, ## What Needs Attention, ## Actionable Steps. Keep each section to 2-4 bullet points. Use plain text only, no asterisks for bullets — use "•" instead.

Portfolio Data:
${JSON.stringify(portfolioSummary, null, 2)}`
          }]
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || 'API error')
      }

      const data = await res.json()
      const text = data.content?.map(c => c.text || '').join('') || ''
      setAiInsight(text)
    } catch (err) {
      setAiError(err.message.includes('API key') || err.message.includes('auth')
        ? 'Firebase proxy not configured. Please set up your Firebase project with the Anthropic API key in Cloud Functions, or use the hardcoded key for development only.'
        : err.message)
    } finally {
      setAiLoading(false)
    }
  }

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'positions', label: 'Positions' },
    { id: 'strategies', label: 'Strategies' },
    { id: 'ai', label: 'AI Analysis' },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title"><Lightbulb size={18} color="var(--accent)" /> Insights</div>
          <div className="page-subtitle">Performance analysis & AI coaching</div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
              padding: '0.4rem 0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem',
              border: activeSection === s.id ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: activeSection === s.id ? 'var(--accent-dim)' : 'transparent',
              color: activeSection === s.id ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer'
            }}>{s.label}</button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {/* Alerts strip */}
        {alerts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {alerts.map((a, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.65rem',
                padding: '0.65rem 1rem',
                background: a.type === 'danger' ? 'var(--red-dim)' : a.type === 'success' ? 'var(--green-dim)' : 'var(--amber-dim)',
                border: `1px solid ${a.type === 'danger' ? 'rgba(255,77,109,0.2)' : a.type === 'success' ? 'rgba(0,200,150,0.2)' : 'rgba(245,166,35,0.2)'}`,
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                color: a.type === 'danger' ? 'var(--red)' : a.type === 'success' ? 'var(--green)' : 'var(--amber)',
                animation: `fadeIn ${0.3 + i * 0.06}s ease`
              }}>
                {a.type === 'danger' ? <XCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> : a.type === 'success' ? <CheckCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />}
                {a.msg}
              </div>
            ))}
          </div>
        )}

        {/* OVERVIEW */}
        {activeSection === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="grid-4">
              {[
                { label: 'Portfolio Return', value: fmtPct(totalGLPct), color: totalGL >= 0 ? 'green' : 'red' },
                { label: 'Win Rate', value: `${winRate}%`, color: winRate >= 50 ? 'green' : 'red' },
                { label: 'Risk/Reward', value: rr > 0 ? rr.toFixed(2) + 'x' : '—', color: rr >= 1 ? 'green' : 'amber' },
                { label: 'Avg Win / Avg Loss', value: avgWin || avgLoss ? `${fmtUSD(avgWin)} / ${fmtUSD(Math.abs(avgLoss))}` : '—', color: 'accent' },
              ].map((s, i) => (
                <div key={i} className={`stat-card ${s.color}`}>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value" style={{ fontSize: '1.25rem' }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Concentration */}
            <div className="card">
              <div style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem' }}>Portfolio Concentration</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {concentration.slice(0, 8).map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 60, fontSize: '0.78rem', fontWeight: 600 }}>{c.ticker}</div>
                    <div style={{ flex: 1, height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: c.pct > 30 ? 'var(--red)' : c.pct > 20 ? 'var(--amber)' : 'var(--accent)', width: `${Math.min(c.pct, 100)}%`, transition: 'width 0.6s ease' }} />
                    </div>
                    <div style={{ width: 45, textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{c.pct.toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* POSITIONS */}
        {activeSection === 'positions' && (
          <div className="grid-2">
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <TrendingUp size={15} color="var(--green)" />
                <span style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Top Winners</span>
              </div>
              {winners.map((p, i) => <PositionRow key={i} pos={p} i={i} />)}
            </div>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <TrendingDown size={15} color="var(--red)" />
                <span style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Underperformers</span>
              </div>
              {losers.map((p, i) => <PositionRow key={i} pos={p} i={i} />)}
            </div>
          </div>
        )}

        {/* STRATEGIES */}
        {activeSection === 'strategies' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Strategy Performance</div>
            </div>
            {strategies.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Log journal entries with strategies to see analysis here</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Strategy</th><th>Wins</th><th>Losses</th><th>Win Rate</th><th>Total P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {strategies.map((s, i) => (
                    <tr key={i}>
                      <td><span style={{ fontWeight: 600 }}>{s.name}</span></td>
                      <td><span style={{ color: 'var(--green)' }}>{s.wins}</span></td>
                      <td><span style={{ color: 'var(--red)' }}>{s.losses}</span></td>
                      <td><span className={`tag ${s.wr >= 50 ? 'tag-green' : 'tag-red'}`}>{s.wr}%</span></td>
                      <td><span style={{ color: s.pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{s.pnl >= 0 ? '+' : ''}{fmtUSD(s.pnl)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* AI ANALYSIS */}
        {activeSection === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-bright)',
              borderRadius: 'var(--radius-lg)',
              padding: '2rem',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Glow */}
              <div style={{ position: 'absolute', top: -30, right: -30, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,170,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                    <Sparkles size={18} color="var(--accent)" />
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem' }}>AI Portfolio Analysis</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Powered by Claude · Analyzes your positions, journal history, and trading patterns
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={generateAIInsight}
                  disabled={aiLoading || !enriched.length}
                  style={{ flexShrink: 0 }}
                >
                  {aiLoading ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing...</> : <><Sparkles size={13} /> Generate Insights</>}
                </button>
              </div>

              {aiError && (
                <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(255,77,109,0.2)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--red)', marginBottom: '1rem' }}>
                  {aiError}
                </div>
              )}

              {!aiInsight && !aiLoading && !aiError && (
                <div style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-muted)' }}>
                  <Lightbulb size={36} color="var(--text-dim)" style={{ marginBottom: '1rem' }} />
                  <div style={{ fontSize: '0.85rem' }}>Click "Generate Insights" to get a personalized AI analysis of your portfolio</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--text-dim)' }}>Uses your live portfolio data, prices, and journal entries</div>
                </div>
              )}

              {aiLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', padding: '1rem 0' }}>
                  {[100, 80, 90, 60, 75].map((w, i) => (
                    <div key={i} style={{ height: 14, borderRadius: 4, background: 'var(--bg-elevated)', width: `${w}%`, animation: `pulse 1.5s ${i * 0.15}s infinite` }} />
                  ))}
                </div>
              )}

              {aiInsight && (
                <div style={{ animation: 'fadeIn 0.4s ease' }}>
                  <AIInsightRenderer text={aiInsight} />
                </div>
              )}
            </div>

            {/* Quick data summary for AI context */}
            <div className="card" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Data Included in Analysis</div>
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <span>📊 {enriched.length} positions across {portfolios.length} portfolios</span>
                <span>📓 {journalEntries.length} journal entries</span>
                <span>💰 {fmtUSD(totalValue)} total value</span>
                <span>📈 Live prices for {tickers.length} tickers</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function PositionRow({ pos, i }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.75rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem', animation: `fadeIn ${0.3 + i * 0.06}s ease` }}>
      <div>
        <div style={{ fontWeight: 700, fontFamily: 'var(--font-display)' }}>{pos.ticker.toUpperCase()}</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{pos.portName}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 600, color: pos.gainLossPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
          {fmtUSD(pos.gainLoss)}
        </div>
        <div style={{ fontSize: '0.72rem', color: pos.gainLossPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
          {pos.gainLossPct >= 0 ? '+' : ''}{pos.gainLossPct.toFixed(2)}%
        </div>
      </div>
    </div>
  )
}

function AIInsightRenderer({ text }) {
  const sections = text.split(/^##\s+/m).filter(Boolean)
  const sectionIcons = { "What's Working": '✅', "What Needs Attention": '⚠️', "Actionable Steps": '🎯' }

  if (sections.length <= 1) {
    return <div style={{ fontSize: '0.85rem', lineHeight: 1.8, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{text}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {sections.map((section, i) => {
        const lines = section.split('\n').filter(Boolean)
        const title = lines[0]
        const bullets = lines.slice(1).filter(l => l.trim().startsWith('•') || l.trim().startsWith('-') || l.trim().length > 0)
        const icon = sectionIcons[title] || '📌'
        return (
          <div key={i} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '1rem 1.25rem', borderLeft: '3px solid var(--accent)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.6rem', color: 'var(--text-primary)' }}>
              {icon} {title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {bullets.map((b, j) => (
                <div key={j} style={{ fontSize: '0.82rem', lineHeight: 1.7, color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem' }}>
                  <ChevronRight size={13} color="var(--accent)" style={{ flexShrink: 0, marginTop: 3 }} />
                  <span>{b.replace(/^[•\-]\s*/, '')}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
