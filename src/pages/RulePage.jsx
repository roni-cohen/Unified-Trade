// src/pages/RulesPage.jsx
import { useState, useEffect, useMemo } from 'react'
import { usePortfolios } from '../hooks/usePortfolios'
import { subscribePositions } from '../lib/db'
import { useLivePrices } from '../hooks/useLivePrices'
import { ShieldCheck, RefreshCw, ChevronDown, Zap } from 'lucide-react'

function fmtUSD(n) {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}
function fmtPct(n, decimals = 1) {
  if (n === undefined || isNaN(n)) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(decimals) + '%'
}

const VS = {
  pass: { dot: 'var(--green)', bg: 'var(--green-dim)', color: 'var(--green)' },
  warn: { dot: 'var(--amber)', bg: 'var(--amber-dim)', color: 'var(--amber)' },
  fail: { dot: 'var(--red)',   bg: 'var(--red-dim)',   color: 'var(--red)'   },
}

function VerdictPill({ v }) {
  const s = VS[v]
  return (
    <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', flexShrink: 0, marginTop: 2, background: s.bg, color: s.color }}>
      {v === 'pass' ? 'Pass' : v === 'warn' ? 'Review' : 'Fail'}
    </span>
  )
}

function catScore(rules) {
  const pts = rules.reduce((s, r) => s + (r.v === 'pass' ? 2 : r.v === 'warn' ? 1 : 0), 0)
  const sc = Math.round((pts / (rules.length * 2)) * 100)
  return { sc, v: sc >= 75 ? 'pass' : sc >= 50 ? 'warn' : 'fail' }
}

function overallScore(cats) {
  const all = cats.flatMap(c => c.rules)
  const pass = all.filter(r => r.v === 'pass').length
  const warn = all.filter(r => r.v === 'warn').length
  const fail = all.filter(r => r.v === 'fail').length
  const sc = Math.round((pass * 2 + warn) / (all.length * 2) * 100)
  return { sc, v: sc >= 75 ? 'pass' : sc >= 50 ? 'warn' : 'fail', pass, warn, fail }
}

function CategoryCard({ cat, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const { sc, v } = catScore(cat.rules)
  const s = VS[v]
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '0.75rem' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.25rem', cursor: 'pointer' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cat.icon}</span>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, fontFamily: 'var(--font-display)' }}>{cat.name}</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{cat.rules.length} rules</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 9px', borderRadius: '999px', background: s.bg, color: s.color }}>{sc}/100</span>
          <ChevronDown size={13} color="var(--text-muted)" style={{ transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }} />
        </div>
      </div>
      {open && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {cat.rules.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.85rem 1.25rem', borderBottom: i < cat.rules.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: VS[r.v].dot, flexShrink: 0, marginTop: 5 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 3 }}>{r.title}</div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{r.detail}</div>
              </div>
              <VerdictPill v={r.v} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ScoreBanner({ sc, v, pass, warn, fail, sub }) {
  const s = VS[v]
  const label = v === 'pass' ? 'Well-structured portfolio' : v === 'warn' ? 'Several areas need attention' : 'Portfolio needs significant work'
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', padding: '1rem 1.5rem' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: s.bg, border: `1.5px solid ${s.dot}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: s.color, lineHeight: 1 }}>{sc}</span>
        <span style={{ fontSize: '0.65rem', color: s.color, opacity: 0.75 }}>/100</span>
      </div>
      <div>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--green)' }}>{pass} passed</span>{' · '}
          <span style={{ color: 'var(--amber)' }}>{warn} warnings</span>{' · '}
          <span style={{ color: 'var(--red)' }}>{fail} failed</span>
          {sub && <span> · {sub}</span>}
        </div>
      </div>
    </div>
  )
}

function MiniStats({ items }) {
  return (
    <div className="grid-4" style={{ marginBottom: '1.25rem' }}>
      {items.map((s, i) => (
        <div key={i} className="stat-card accent" style={{ padding: '0.85rem 1rem' }}>
          <div className="stat-label">{s.label}</div>
          <div className="stat-value" style={{ fontSize: '1.2rem', color: s.color || 'var(--text-primary)' }}>{s.value}</div>
        </div>
      ))}
    </div>
  )
}

// ── Rule builders ─────────────────────────────────────────────────────────────

function buildPortfolioCats(enriched, portfolios) {
  const total = enriched.reduce((s, p) => s + p.currentValue, 0)
  if (!total) return []

  const smap = {}
  enriched.forEach(p => { smap[p.sector || 'Unknown'] = (smap[p.sector || 'Unknown'] || 0) + p.currentValue })
  const sw = Object.entries(smap).map(([s, v]) => ({ s, pct: (v / total) * 100 }))
  const topSec = sw.reduce((a, b) => a.pct > b.pct ? a : b, { s: '', pct: 0 })
  const numSec = sw.length
  const etfPct = sw.filter(x => x.s === 'ETF/Blend').reduce((s, x) => s + x.pct, 0)
  const defPct = sw.filter(x => ['Healthcare','Utilities','Consumer Staples','Real Estate'].includes(x.s)).reduce((s, x) => s + x.pct, 0)
  const techPct = sw.filter(x => x.s === 'Technology').reduce((s, x) => s + x.pct, 0)
  const cycPct = sw.filter(x => ['Energy','Financials','Materials','Industrials','Consumer Discretionary'].includes(x.s)).reduce((s, x) => s + x.pct, 0)
  const engPct = sw.filter(x => x.s === 'Energy').reduce((s, x) => s + x.pct, 0)

  const wts = enriched.map(p => (p.currentValue / total) * 100)
  const maxW = Math.max(...wts)
  const maxP = enriched[wts.indexOf(maxW)]
  const top3 = [...wts].sort((a, b) => b - a).slice(0, 3).reduce((s, v) => s + v, 0)

  const losers = enriched.filter(p => p.gainLossPct < 0)
  const winners = enriched.filter(p => p.gainLossPct > 0)
  const bigL = losers.filter(p => p.gainLossPct < -15)
  const bigW = winners.filter(p => p.gainLossPct > 50)
  const lval = losers.reduce((s, p) => s + p.currentValue, 0)
  const avgPL = enriched.reduce((s, p) => s + p.gainLossPct, 0) / enriched.length
  const portBeta = enriched.reduce((s, p) => s + ((p.beta || 1) * (p.currentValue / total)), 0)
  const highBeta = enriched.filter(p => p.type !== 'ETF' && (p.beta || 1) > 1.5)
  const etfCount = enriched.filter(p => p.type === 'ETF').length
  const techOverlap = etfCount > 1 && techPct > 30

  const rangePcts = enriched.map(p => {
    if (!p.low52w || !p.high52w || p.high52w <= p.low52w) return null
    return { ticker: p.ticker, pct: ((p.currentValue - p.low52w) / (p.high52w - p.low52w)) * 100 }
  }).filter(Boolean)
  const nearHigh = rangePcts.filter(x => x.pct > 85)
  const nearLow  = rangePcts.filter(x => x.pct < 15)

  return [
    {
      icon: '◈', name: 'Diversification', rules: [
        { v: topSec.pct > 50 ? 'fail' : topSec.pct > 35 ? 'warn' : 'pass', title: 'Sector concentration', detail: `Top sector: ${topSec.s} at ${topSec.pct.toFixed(1)}%. ${topSec.pct > 50 ? 'Critical overconcentration — trim and rotate into underweighted sectors.' : topSec.pct > 35 ? 'Elevated — aim for ≤30% per sector.' : 'Well distributed across sectors.'}` },
        { v: numSec < 3 ? 'fail' : numSec < 5 ? 'warn' : 'pass', title: 'Sector breadth', detail: `${numSec} sector(s) represented. ${numSec < 3 ? 'Dangerously narrow — target 5–8 sectors for adequate coverage.' : numSec < 5 ? 'Below optimal. Add exposure in 2–3 additional sectors.' : 'Solid breadth across multiple sectors.'}` },
        { v: etfPct === 0 ? 'warn' : etfPct > 60 ? 'warn' : 'pass', title: 'ETF vs stock balance', detail: `ETFs: ${etfPct.toFixed(1)}% of portfolio. ${etfPct === 0 ? 'No ETF exposure — add a broad index for a diversified core.' : etfPct > 60 ? 'ETF-heavy. A core/satellite structure (60% ETF, 40% stocks) is optimal.' : 'Healthy balance between ETF core and individual stock alpha.'}` },
        { v: techOverlap ? 'warn' : 'pass', title: 'ETF overlap risk', detail: techOverlap ? `Multiple ETFs alongside ${techPct.toFixed(1)}% tech — SPY + QQQ creates heavy duplication in mega-cap tech. Audit overlapping holdings.` : 'No significant ETF overlap detected.' },
        { v: portfolios.length > 5 ? 'warn' : 'pass', title: 'Portfolio sprawl', detail: `${portfolios.length} portfolio(s) tracked. ${portfolios.length > 5 ? 'Too many portfolios makes it hard to track overall exposure. Consider consolidating.' : 'Portfolio count is manageable.'}` },
      ]
    },
    {
      icon: '◎', name: 'Risk management', rules: [
        { v: maxW > 25 ? 'fail' : maxW > 15 ? 'warn' : 'pass', title: 'Single position size', detail: `Largest: ${maxP?.ticker?.toUpperCase()} at ${maxW.toFixed(1)}% (${fmtUSD(maxP?.currentValue)}). ${maxW > 25 ? 'Exceeds 20% rule — a 50% drawdown costs ' + (maxW * 0.5).toFixed(1) + '% of total portfolio.' : maxW > 15 ? 'Approaching 15% guideline — monitor and consider trimming.' : 'Good sizing — no single position dominates.'}` },
        { v: top3 > 60 ? 'fail' : top3 > 45 ? 'warn' : 'pass', title: 'Top 3 concentration', detail: `Top 3 positions: ${top3.toFixed(1)}% of portfolio. ${top3 > 60 ? 'Back-heavy — a correlated selloff in your top 3 would be severely damaging.' : top3 > 45 ? 'Moderately concentrated. Spread capital into lower-ranked positions.' : 'Healthy top-3 spread.'}` },
        { v: portBeta > 1.5 ? 'fail' : portBeta > 1.2 ? 'warn' : portBeta < 0.6 ? 'warn' : 'pass', title: 'Portfolio beta', detail: `Weighted portfolio beta: ${portBeta.toFixed(2)}. ${portBeta > 1.5 ? 'Very high — in a 10% market drop, expect ~' + (portBeta * 10).toFixed(0) + '% loss. Add defensive positions.' : portBeta > 1.2 ? 'Above 1.0 — more volatile than the market. Acceptable for aggressive investors.' : portBeta < 0.6 ? 'Unusually low — portfolio may underperform in strong bull markets.' : 'Healthy beta — balanced market-correlated risk.'}` },
        { v: highBeta.length > 2 ? 'warn' : 'pass', title: 'High-beta position count', detail: `${highBeta.length} stock(s) with beta >1.5: ${highBeta.length ? highBeta.map(p => p.ticker.toUpperCase()).join(', ') : 'none'}. ${highBeta.length > 2 ? 'Multiple high-beta holdings amplify drawdowns. Balance with lower-beta names.' : 'Beta distribution is healthy.'}` },
        { v: (lval / total) * 100 > 30 ? 'fail' : (lval / total) * 100 > 15 ? 'warn' : 'pass', title: 'Capital in losing positions', detail: `${((lval / total) * 100).toFixed(1)}% of capital (${fmtUSD(lval)}) in losing positions.${bigL.length ? ' Deep losers (>15% down): ' + bigL.map(p => p.ticker.toUpperCase()).join(', ') + '.' : ''} ${(lval / total) * 100 > 30 ? 'Excessive — cut or hedge underperformers.' : 'Portfolio is mostly in profitable territory.'}` },
      ]
    },
    {
      icon: '⊡', name: 'Portfolio balance', rules: [
        { v: winners.length < losers.length ? 'fail' : winners.length === losers.length ? 'warn' : 'pass', title: 'Winners vs losers', detail: `${winners.length} winners, ${losers.length} losers (win rate: ${enriched.length ? Math.round((winners.length / enriched.length) * 100) : 0}%). ${winners.length < losers.length ? 'More losers than winners — reassess thesis on each losing position.' : winners.length === losers.length ? 'Even split. Review losers individually.' : 'More winners — healthy selection quality.'}` },
        { v: bigW.length > 2 ? 'warn' : bigW.length > 0 ? 'warn' : 'pass', title: 'Runaway winner drift', detail: `${bigW.length} position(s) up >50%: ${bigW.length ? bigW.map(p => `${p.ticker.toUpperCase()} (+${p.gainLossPct.toFixed(0)}%)`).join(', ') : 'none'}. ${bigW.length ? 'Large gains silently shift your allocation beyond original intent. Re-evaluate weight and consider trimming.' : 'No positions have drifted to distort the original plan.'}` },
        { v: avgPL < 0 ? 'fail' : avgPL < 5 ? 'warn' : 'pass', title: 'Average position P/L', detail: `Mean P/L across all positions: ${fmtPct(avgPL)}. ${avgPL < 0 ? 'Net negative — consider rotating underperformers into stronger candidates.' : avgPL < 5 ? 'Low average return. Review stock selection criteria.' : 'Strong average return — reflects quality selection.'}` },
        { v: bigL.length > 1 ? 'fail' : bigL.length === 1 ? 'warn' : 'pass', title: 'Stop-loss discipline', detail: `${bigL.length} position(s) past the 15% loss threshold: ${bigL.length ? bigL.map(p => `${p.ticker.toUpperCase()} (${p.gainLossPct.toFixed(0)}%)`).join(', ') : 'none'}. ${bigL.length ? 'A pre-defined stop-loss rule prevents small losses becoming large ones. Review whether the thesis is still intact.' : 'Stop-loss levels appear respected.'}` },
      ]
    },
    {
      icon: '◇', name: 'Valuation & entry', rules: [
        { v: nearHigh.length > enriched.length * 0.5 ? 'warn' : nearHigh.length > 0 ? 'warn' : 'pass', title: 'Positions near 52-week high', detail: `${nearHigh.length} position(s) within 15% of 52-week high: ${nearHigh.length ? nearHigh.map(x => x.ticker.toUpperCase()).join(', ') : 'none'}. ${nearHigh.length ? 'Near-high entries carry reversal risk. Ensure a clear momentum thesis and set trailing stops.' : 'Most positions entered at favorable levels.'}` },
        { v: nearLow.length > 0 ? 'warn' : 'pass', title: 'Positions near 52-week low', detail: `${nearLow.length} position(s) within 15% of 52-week low: ${nearLow.length ? nearLow.map(x => x.ticker.toUpperCase()).join(', ') : 'none'}. ${nearLow.length ? 'Distinguish oversold opportunity from value trap — is the thesis still intact?' : 'No positions near annual lows.'}` },
        { v: enriched.filter(p => p.gainLossPct > 70 && p.type !== 'ETF').length > 1 ? 'warn' : 'pass', title: 'Momentum chasing', detail: (() => { const hot = enriched.filter(p => p.gainLossPct > 70 && p.type !== 'ETF'); return `${hot.length} stock(s) with P/L >70%: ${hot.length ? hot.map(p => p.ticker.toUpperCase()).join(', ') : 'none'}. ${hot.length > 1 ? 'Multiple extreme movers suggest chasing at stretched valuations. Define profit-taking levels.' : 'No extreme momentum overweights.'}` })() },
        { v: enriched.filter(p => p.type === 'ETF' && p.gainLossPct < 0).length > 0 ? 'warn' : 'pass', title: 'ETF underperformance', detail: (() => { const bad = enriched.filter(p => p.type === 'ETF' && p.gainLossPct < 0); return `${bad.length} ETF(s) in loss: ${bad.length ? bad.map(p => p.ticker.toUpperCase()).join(', ') : 'none'}. ${bad.length ? 'Review whether the macro thesis behind each ETF is still valid.' : 'All ETFs are currently profitable.'}` })() },
      ]
    },
    {
      icon: '◉', name: 'Market trend exposure', rules: [
        { v: defPct < 5 ? 'warn' : defPct > 40 ? 'warn' : 'pass', title: 'Defensive allocation', detail: `Defensive sectors (Healthcare, Utilities, Staples, Real Estate): ${defPct.toFixed(1)}%. ${defPct < 5 ? 'Very low defensive buffer. Add 10–15% in defensive names to cushion in risk-off environments.' : defPct > 40 ? 'Overly defensive — may miss bull market upside.' : 'Adequate defensive cushion.'}` },
        { v: techPct > 45 ? 'fail' : techPct > 30 ? 'warn' : 'pass', title: 'Technology vs market weight', detail: `Technology: ${techPct.toFixed(1)}% (S&P 500 ≈30%). ${techPct > 45 ? 'Significantly above market weight — tech valuations compress in rate-rising cycles. Consider trimming.' : techPct > 30 ? 'Slight overweight — intentional or incidental? Monitor valuation multiples.' : 'Tech weight at or below market weight.'}` },
        { v: portBeta > 1.3 && defPct < 10 ? 'warn' : 'pass', title: 'Bull/bear regime preparedness', detail: `Beta ${portBeta.toFixed(2)} with ${defPct.toFixed(1)}% defensive allocation. ${portBeta > 1.3 && defPct < 10 ? 'High-beta, low-defense portfolio is exposed in corrections. Consider adding a hedge or defensive layer.' : 'Reasonable balance between upside capture and downside protection.'}` },
        { v: engPct > 20 ? 'warn' : 'pass', title: 'Energy/commodity cyclicality', detail: `Energy: ${engPct.toFixed(1)}% of portfolio. ${engPct > 20 ? 'Heavy energy weighting ties performance to oil/gas cycles and geopolitical risk — ensure this is intentional.' : 'Energy allocation is within a prudent range.'}` },
        { v: cycPct > 50 ? 'warn' : 'pass', title: 'Cyclical sector exposure', detail: `Cyclical sectors: ${cycPct.toFixed(1)}%. ${cycPct > 50 ? 'Heavy cyclical exposure — portfolio underperforms significantly in recessions. Ensure this aligns with your macro view.' : 'Cyclical exposure is within a reasonable range.'}` },
      ]
    },
  ]
}

function buildIndividualCats(pos, total) {
  const weight = total ? (pos.currentValue / total) * 100 : 0
  const beta = pos.beta || 1
  const hasRange = pos.low52w && pos.high52w && pos.high52w > pos.low52w
  const inRange = hasRange ? Math.min(100, Math.max(0, ((pos.currentValue - pos.low52w) / (pos.high52w - pos.low52w)) * 100)) : 50
  const isNearHigh = inRange > 85
  const isNearLow  = inRange < 15
  const pl = pos.gainLossPct

  return [
    {
      icon: '◇', name: 'Entry & valuation', rules: [
        { v: hasRange ? (isNearHigh || isNearLow ? 'warn' : 'pass') : 'warn', title: '52-week range position', detail: hasRange ? `At ${inRange.toFixed(0)}% of 52-week range ($${pos.low52w}–$${pos.high52w}). ${isNearHigh ? 'Near annual highs — entry is expensive. A compelling catalyst is required to justify chasing.' : isNearLow ? 'Near annual lows — potential opportunity or falling knife. Verify fundamentals support a recovery.' : 'Trading in the middle of its annual range — neutral entry zone.'}` : 'No 52-week range data. Edit this position in Portfolios to add low52w / high52w and unlock this analysis.' },
        { v: pl > 80 ? 'warn' : pl > 50 ? 'warn' : pl < -20 ? 'fail' : 'pass', title: 'Current P/L assessment', detail: `Currently ${fmtPct(pl)} from average cost. ${pl > 80 ? 'Exceptional gain — define your profit-taking strategy. Consider selling a portion to lock in returns.' : pl > 50 ? 'Strong gain — re-evaluate thesis. If the reasons for buying have been met, a partial exit may be appropriate.' : pl < -20 ? 'Deep loss — urgently reassess whether the thesis is intact. Holding through large losses requires exceptional conviction.' : pl < 0 ? 'Small loss within normal range. Monitor whether the thesis is playing out on the expected timeline.' : 'Healthy gain. Stay disciplined with your original exit criteria.'}` },
        { v: pl < -20 ? 'fail' : pl < -15 ? 'warn' : 'pass', title: 'Stop-loss trigger', detail: pos.type !== 'ETF' ? `Loss at ${Math.abs(pl).toFixed(1)}%. ${pl < -15 ? 'Has breached a standard 15% stop-loss level. Review or exit. If holding, document the specific reason the thesis overrides the stop.' : pl < 0 ? 'Within acceptable range. Set a hard stop at -15% if not already in place.' : 'Position is profitable — consider a trailing stop to protect gains.'}` : 'ETF positions can typically tolerate wider drawdowns. Consider a -20% threshold for broad ETFs.' },
      ]
    },
    {
      icon: '◎', name: 'Risk & sizing', rules: [
        { v: weight > 25 ? 'fail' : weight > 15 ? 'warn' : 'pass', title: 'Position weight', detail: `${pos.ticker.toUpperCase()} is ${weight.toFixed(1)}% of total portfolio (${fmtUSD(pos.currentValue)}). ${weight > 25 ? 'Exceeds 20% single-stock rule. A 50% drawdown here costs ' + (weight * 0.5).toFixed(1) + '% of total portfolio.' : weight > 15 ? 'Approaching elevated weight. Consider trimming if conviction has weakened.' : 'Position sizing within healthy range.'}` },
        { v: beta > 1.8 ? 'fail' : beta > 1.3 ? 'warn' : beta < 0.4 ? 'warn' : 'pass', title: 'Beta & volatility contribution', detail: `Beta: ${beta.toFixed(2)}. ${beta > 1.8 ? 'Very high beta — amplifies portfolio swings. In a 10% market drop, expect ~' + Math.round(beta * 10) + '% loss on this position.' : beta > 1.3 ? 'Above-market volatility. Acceptable if sized appropriately.' : beta < 0.4 ? 'Very low beta — good stabilizer but limits upside in bull markets.' : 'Normal beta — balanced market-correlated risk.'}` },
        { v: pos.type !== 'ETF' && weight > 10 && beta > 1.3 ? 'warn' : 'pass', title: 'Combined size + volatility risk', detail: `Weight ${weight.toFixed(1)}% × Beta ${beta.toFixed(2)} = risk score ${(weight * beta).toFixed(1)}. ${pos.type !== 'ETF' && weight > 10 && beta > 1.3 ? 'Large AND volatile — a bad quarter will have outsized portfolio impact. Reduce size or consciously accept the concentration.' : 'Risk contribution is within normal bounds.'}` },
      ]
    },
    {
      icon: '⊡', name: 'Position quality', rules: [
        { v: pl > 0 && isNearHigh ? 'warn' : pl < 0 && isNearLow ? 'warn' : 'pass', title: 'Trend alignment', detail: hasRange ? `${fmtPct(pl)} P/L at ${inRange.toFixed(0)}% of 52-week range. ${pl > 0 && isNearHigh ? 'Profitable near highs — use trailing stops to protect gains if sentiment reverses.' : pl < 0 && isNearLow ? 'Negative trend AND near annual lows — double-negative signal. Very high conviction required to hold.' : pl > 0 ? 'Profitable and not overextended — favorable.' : 'In a loss but not at annual low — may be a temporary pullback. Monitor the next support level.'}` : `P/L is ${fmtPct(pl)}. Enter 52-week range data for deeper trend analysis.` },
        { v: pl < -5 && beta > 1.2 && pos.type !== 'ETF' ? 'warn' : 'pass', title: 'Sector headwind check', detail: `Sector: ${pos.sector || 'Unknown'}. Beta: ${beta.toFixed(2)}. ${pl < -5 && beta > 1.2 && pos.type !== 'ETF' ? 'High-beta stock in a drawdown — check whether the entire sector is under pressure or this is company-specific. If sector-wide, consider reducing theme exposure.' : 'No specific sector headwind flagged from current data.'}` },
        { v: pl < 0 && weight > 10 ? 'warn' : 'pass', title: 'Capital opportunity cost', detail: `${fmtUSD(pos.currentValue)} at ${weight.toFixed(1)}% of portfolio, returning ${fmtPct(pl)}. ${pl < 0 && weight > 10 ? 'Large capital in a losing position — significant opportunity cost. A partial reduction may free capital for higher-conviction ideas.' : 'Capital deployed relative to return is acceptable.'}` },
      ]
    },
    {
      icon: '◈', name: 'Hold vs review', rules: [
        { v: pl < -20 ? 'fail' : pl < -10 ? 'warn' : 'pass', title: 'Thesis check trigger', detail: pl < -10 ? `Down ${Math.abs(pl).toFixed(1)}% — triggers a formal thesis review. Ask: (1) Has the reason I bought this changed? (2) Is the timeline still valid? (3) Would I buy this today? If any answer is no — exit.` : 'Within range that does not require a formal reassessment. Set a review trigger at -10%.' },
        { v: pl > 100 && weight > 15 ? 'fail' : pl > 60 && weight > 12 ? 'warn' : 'pass', title: 'Profit-taking signal', detail: `Up ${fmtPct(pl)} at ${weight.toFixed(1)}% of portfolio. ${pl > 100 && weight > 15 ? 'Position has doubled AND is heavily weighted — strong signal to take partial profits and rebalance.' : pl > 60 && weight > 12 ? 'Significant gain at notable weight. Consider trimming 25–30% to lock in returns.' : 'No urgent profit-taking signal.'}` },
        { v: 'pass', title: 'Conviction rating check', detail: `Before your next review, rate your conviction in ${pos.ticker.toUpperCase()} from 1–5. If you score below 3 but still hold it, that is a "hope" position — the most dangerous kind. Only hold positions where you can articulate the thesis in one sentence.` },
      ]
    },
  ]
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RulesPage() {
  const { portfolios } = usePortfolios()
  const [allPositions, setAllPositions] = useState([])
  const [view, setView] = useState('portfolio')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [ran, setRan] = useState(false)

  useEffect(() => {
    if (!portfolios.length) return
    const byPort = {}
    const unsubs = portfolios.map(p => subscribePositions(p.id, positions => {
      byPort[p.id] = positions
      setAllPositions(Object.values(byPort).flat())
    }))
    return () => unsubs.forEach(u => u())
  }, [portfolios.map(p => p.id).join(',')])

  const tickers = useMemo(() => [...new Set(allPositions.map(p => p.ticker.toUpperCase()))], [allPositions])
  const { prices, loading: priceLoading, lastUpdated, refresh } = useLivePrices(tickers)

  const enriched = useMemo(() => allPositions.map(pos => {
    const pd = prices[pos.ticker.toUpperCase()]
    const currentPrice = pd?.price ?? pos.avgCost
    const currentValue = currentPrice * pos.shares
    const costBasis = pos.avgCost * pos.shares
    const gainLossPct = costBasis > 0 ? ((currentValue - costBasis) / costBasis) * 100 : 0
    const portName = portfolios.find(p => p.id === pos.portfolioId)?.name || 'Unknown'
    return {
      ...pos, currentPrice, currentValue, costBasis,
      gainLoss: currentValue - costBasis, gainLossPct, portName,
      beta: pos.beta || 1, low52w: pos.low52w || null, high52w: pos.high52w || null,
    }
  }), [allPositions, prices, portfolios])

  const total = enriched.reduce((s, p) => s + p.currentValue, 0)

  const portCats = useMemo(() => ran && enriched.length ? buildPortfolioCats(enriched, portfolios) : [], [ran, enriched, portfolios])
  const portOverall = useMemo(() => portCats.length ? overallScore(portCats) : null, [portCats])

  const selectedPos = enriched[selectedIdx] || enriched[0]
  const indivCats = useMemo(() => selectedPos ? buildIndividualCats(selectedPos, total) : [], [selectedPos, total])
  const indivOverall = useMemo(() => indivCats.length ? overallScore(indivCats) : null, [indivCats])

  const portBeta = enriched.length ? enriched.reduce((s, p) => s + (p.beta * p.currentValue), 0) / total : 0
  const avgPL = enriched.length ? enriched.reduce((s, p) => s + p.gainLossPct, 0) / enriched.length : 0

  const portMiniStats = [
    { label: 'Portfolio beta', value: enriched.length ? portBeta.toFixed(2) : '—' },
    { label: 'Win rate', value: enriched.length ? Math.round((enriched.filter(p => p.gainLossPct > 0).length / enriched.length) * 100) + '%' : '—' },
    { label: 'Avg P/L', value: enriched.length ? fmtPct(avgPL) : '—', color: avgPL >= 0 ? 'var(--green)' : 'var(--red)' },
    { label: 'Sectors', value: enriched.length ? [...new Set(enriched.map(p => p.sector || 'Unknown'))].length : '—' },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title"><ShieldCheck size={18} color="var(--accent)" /> Rule Analyst</div>
          <div className="page-subtitle">
            {enriched.length} position{enriched.length !== 1 ? 's' : ''} · {fmtUSD(total)} total · {portfolios.length} portfolio{portfolios.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {lastUpdated && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Updated {lastUpdated.toLocaleTimeString()}</span>}
          <button className="btn btn-ghost" onClick={refresh} disabled={priceLoading} style={{ gap: '0.4rem' }}>
            <RefreshCw size={13} style={{ animation: priceLoading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {[{ id: 'portfolio', label: 'Portfolio analysis' }, { id: 'individual', label: 'Individual position' }].map(t => (
            <button key={t.id} onClick={() => setView(t.id)} style={{
              padding: '0.55rem 1rem', fontSize: '0.8rem', fontWeight: 600,
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: view === t.id ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: view === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1, fontFamily: 'var(--font-mono)',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── PORTFOLIO VIEW ── */}
        {view === 'portfolio' && (
          enriched.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No positions found. Add positions in Portfolios first.
            </div>
          ) : !ran ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <ShieldCheck size={40} color="var(--text-dim)" style={{ marginBottom: '1rem' }} />
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Ready to analyse
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
                {enriched.length} positions · {portfolios.length} portfolio{portfolios.length !== 1 ? 's' : ''} · {fmtUSD(total)} total
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setRan(true)}
                style={{ gap: '0.5rem', padding: '0.65rem 1.5rem', fontSize: '0.85rem' }}
              >
                <Zap size={14} /> Run portfolio analysis
              </button>
            </div>
          ) : (
            <>
              <ScoreBanner {...portOverall} sub={`${enriched.length} positions · ${fmtUSD(total)}`} />
              <MiniStats items={portMiniStats} />
              {portCats.map((cat, i) => <CategoryCard key={i} cat={cat} defaultOpen={i === 0} />)}
              <button className="btn btn-ghost" onClick={() => setRan(false)} style={{ marginTop: '0.5rem', fontSize: '0.75rem', gap: '0.4rem' }}>
                <RefreshCw size={12} /> Re-run analysis
              </button>
            </>
          )
        )}

        {/* ── INDIVIDUAL VIEW ── */}
        {view === 'individual' && (
          enriched.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No positions found. Add positions in Portfolios first.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Analysing:</span>
                <select
                  value={selectedIdx}
                  onChange={e => setSelectedIdx(parseInt(e.target.value))}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', maxWidth: 300 }}
                >
                  {enriched.map((p, i) => (
                    <option key={i} value={i}>{p.ticker.toUpperCase()} — {p.portName} ({fmtPct(p.gainLossPct)})</option>
                  ))}
                </select>
              </div>

              {selectedPos && (
                <>
                  <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', padding: '1rem 1.5rem' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid rgba(0,212,170,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                      {selectedPos.ticker.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>
                        {selectedPos.ticker.toUpperCase()}
                        <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                          {selectedPos.type} · {selectedPos.sector || 'Unknown sector'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {fmtUSD(selectedPos.currentValue)} · {((selectedPos.currentValue / total) * 100).toFixed(1)}% of portfolio · {selectedPos.portName}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', textAlign: 'right', flexShrink: 0 }}>
                      {[
                        { label: 'P/L', value: fmtPct(selectedPos.gainLossPct), color: selectedPos.gainLossPct >= 0 ? 'var(--green)' : 'var(--red)' },
                        { label: 'Beta', value: (selectedPos.beta || 1).toFixed(2) },
                        { label: 'Health', value: indivOverall ? `${indivOverall.sc}/100` : '—' },
                      ].map((s, i) => (
                        <div key={i}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, fontFamily: 'var(--font-display)', color: s.color || 'var(--text-primary)' }}>{s.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {indivOverall && <ScoreBanner {...indivOverall} sub={`${indivCats.flatMap(c => c.rules).length} rules evaluated`} />}
                  {indivCats.map((cat, i) => <CategoryCard key={i} cat={cat} defaultOpen={i === 0} />)}

                  {(!selectedPos.low52w || !selectedPos.high52w) && (
                    <div style={{ marginTop: '0.75rem', padding: '0.65rem 1rem', background: 'var(--amber-dim)', border: '1px solid rgba(245,166,35,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.76rem', color: 'var(--amber)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                      <Zap size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                      Add <strong style={{ margin: '0 2px' }}>beta</strong>, <strong style={{ margin: '0 2px' }}>52-week low</strong> and <strong style={{ margin: '0 2px' }}>52-week high</strong> when editing this position in Portfolios to unlock the full range and volatility analysis.
                    </div>
                  )}
                </>
              )}
            </>
          )
        )}
      </div>
    </>
  )
}