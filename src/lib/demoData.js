// src/lib/demoData.js
// In-memory store used when Firebase is not configured (IS_DEMO === true).
// All reads/writes work identically to the real db.js API — just stored in RAM.

let _portfolios = [
  { id: 'p1', name: 'Growth Fund',  description: 'Long-term compounders', broker: 'Fidelity',   color: '#00d4aa', userId: 'demo', createdAt: { seconds: 1700000000 } },
  { id: 'p2', name: 'Tech Bets',    description: 'High-conviction tech',  broker: 'Robinhood',  color: '#3d8ef0', userId: 'demo', createdAt: { seconds: 1700000100 } },
  { id: 'p3', name: 'Dividends',    description: 'Income-focused',        broker: 'IBKR',       color: '#f5a623', userId: 'demo', createdAt: { seconds: 1700000200 } },
]

let _positions = [
  { id: 'pos1', portfolioId: 'p1', userId: 'demo', ticker: 'AAPL',  shares: 20,  avgCost: 145.00, notes: 'Core holding',         beta: 0.90, low52w: 164, high52w: 237, sector: 'Technology' },
  { id: 'pos2', portfolioId: 'p1', userId: 'demo', ticker: 'MSFT',  shares: 10,  avgCost: 280.00, notes: '',                     beta: 0.85, low52w: 344, high52w: 468, sector: 'Technology' },
  { id: 'pos3', portfolioId: 'p1', userId: 'demo', ticker: 'NVDA',  shares: 15,  avgCost: 420.00, notes: 'AI play — long term',  beta: 1.70, low52w: 462, high52w: 974, sector: 'Technology' },
  { id: 'pos4', portfolioId: 'p2', userId: 'demo', ticker: 'META',  shares: 8,   avgCost: 310.00, notes: 'Reels monetisation',   beta: 1.20, low52w: 414, high52w: 740, sector: 'Technology' },
  { id: 'pos5', portfolioId: 'p2', userId: 'demo', ticker: 'GOOGL', shares: 12,  avgCost: 130.00, notes: 'Search + Cloud',       beta: 1.05, low52w: 151, high52w: 208, sector: 'Technology' },
  { id: 'pos6', portfolioId: 'p2', userId: 'demo', ticker: 'INTC',  shares: 30,  avgCost: 38.00,  notes: 'Turnaround bet',       beta: 1.00, low52w: 18,  high52w: 37,  sector: 'Technology' },
  { id: 'pos7', portfolioId: 'p3', userId: 'demo', ticker: 'JNJ',   shares: 25,  avgCost: 155.00, notes: 'Dividend aristocrat',  beta: 0.45, low52w: 143, high52w: 168, sector: 'Healthcare' },
  { id: 'pos8', portfolioId: 'p3', userId: 'demo', ticker: 'SPY',   shares: 5,   avgCost: 420.00, notes: 'Core index',           beta: 1.00, low52w: 492, high52w: 610, sector: 'ETF/Blend' },
  { id: 'pos9', portfolioId: 'p3', userId: 'demo', ticker: 'VYM',   shares: 40,  avgCost: 105.00, notes: 'High yield ETF',       beta: 0.65, low52w: 110, high52w: 135, sector: 'ETF/Blend' },
]

let _journal = [
  { id: 'j1', userId: 'demo', date: '2025-03-15', ticker: 'NVDA',  action: 'buy',  shares: 15, price: 420, mood: 'confident', strategy: 'Momentum',    outcome: 'win',  pnl: 6831,  notes: 'Breaking out of consolidation. Strong AI demand thesis.', tags: ['AI', 'breakout'], createdAt: { seconds: 1742000000 } },
  { id: 'j2', userId: 'demo', date: '2025-03-08', ticker: 'INTC',  action: 'buy',  shares: 30, price: 38,  mood: 'cautious',  strategy: 'Value',        outcome: 'loss', pnl: -196,  notes: 'Bought the dip. Thesis: fab recovery. Not playing out.', tags: ['value', 'turnaround'], createdAt: { seconds: 1741400000 } },
  { id: 'j3', userId: 'demo', date: '2025-02-22', ticker: 'MSFT',  action: 'buy',  shares: 10, price: 280, mood: 'neutral',   strategy: 'Value',        outcome: 'win',  pnl: 1352,  notes: 'Cloud growth re-accelerating. Copilot adoption.', tags: ['cloud', 'AI'], createdAt: { seconds: 1740800000 } },
  { id: 'j4', userId: 'demo', date: '2025-02-10', ticker: 'SPY',   action: 'buy',  shares: 5,  price: 420, mood: 'neutral',   strategy: 'Buy & Hold',   outcome: 'open', pnl: null,  notes: 'Regular DCA into index.', tags: ['DCA'], createdAt: { seconds: 1740200000 } },
  { id: 'j5', userId: 'demo', date: '2025-01-18', ticker: 'META',  action: 'buy',  shares: 8,  price: 310, mood: 'confident', strategy: 'Momentum',    outcome: 'win',  pnl: 920,   notes: 'Reels growing. Ad revenue recovery strong.', tags: ['social', 'ads'], createdAt: { seconds: 1737200000 } },
  { id: 'j6', userId: 'demo', date: '2024-12-05', ticker: 'PARA',  action: 'buy',  shares: 50, price: 14,  mood: 'greedy',    strategy: 'Value',        outcome: 'loss', pnl: -110,  notes: 'Streaming pivot. Probably a mistake.', tags: ['media'], createdAt: { seconds: 1733400000 } },
  { id: 'j7', userId: 'demo', date: '2024-11-20', ticker: 'AAPL',  action: 'buy',  shares: 20, price: 145, mood: 'neutral',   strategy: 'Buy & Hold',  outcome: 'win',  pnl: 886,   notes: 'Services segment growing. iPhone cycle.', tags: ['core'], createdAt: { seconds: 1732100000 } },
  { id: 'j8', userId: 'demo', date: '2024-10-10', ticker: 'GOOGL', action: 'buy',  shares: 12, price: 130, mood: 'confident', strategy: 'Value',        outcome: 'win',  pnl: 780,   notes: 'Cheap relative to growth. Cloud catching up.', tags: ['cloud', 'value'], createdAt: { seconds: 1728600000 } },
]

let _snapshots = []
let _tradeHistory = []
let _idCounter = 100

function uid() { return 'demo_' + (++_idCounter) }

const _listeners = { portfolios: [], positions: {}, journal: [], tradeHistory: [] }

function notifyPortfolios() {
  _listeners.portfolios.forEach(fn => fn([..._portfolios]))
}
function notifyPositions(portfolioId) {
  const fns = _listeners.positions[portfolioId] || []
  const filtered = _positions.filter(p => p.portfolioId === portfolioId)
  fns.forEach(fn => fn([...filtered]))
}
function notifyJournal() {
  const sorted = [..._journal].sort((a, b) => b.createdAt.seconds - a.createdAt.seconds)
  _listeners.journal.forEach(fn => fn(sorted))
}

// ── PORTFOLIOS ───────────────────────────────────────────────────────────────

export function subscribePortfolios(userId, callback) {
  _listeners.portfolios.push(callback)
  setTimeout(() => callback([..._portfolios]), 0)
  return () => {
    _listeners.portfolios = _listeners.portfolios.filter(fn => fn !== callback)
  }
}

export async function createPortfolio(userId, data) {
  const id = uid()
  _portfolios.push({ id, userId, createdAt: { seconds: Date.now() / 1000 }, ...data })
  notifyPortfolios()
  return { id }
}

export async function updatePortfolio(id, data) {
  _portfolios = _portfolios.map(p => p.id === id ? { ...p, ...data } : p)
  notifyPortfolios()
}

export async function deletePortfolio(id) {
  _portfolios = _portfolios.filter(p => p.id !== id)
  _positions = _positions.filter(p => p.portfolioId !== id)
  notifyPortfolios()
  Object.keys(_listeners.positions).forEach(pid => notifyPositions(pid))
}

export async function updatePortfolioCash(portfolioId, cash) {
  _portfolios = _portfolios.map(p => p.id === portfolioId ? { ...p, cash: parseFloat(cash) || 0 } : p)
  notifyPortfolios()
}

// ── POSITIONS ────────────────────────────────────────────────────────────────

export function subscribePositions(portfolioId, callback) {
  if (!_listeners.positions[portfolioId]) _listeners.positions[portfolioId] = []
  _listeners.positions[portfolioId].push(callback)
  setTimeout(() => callback(_positions.filter(p => p.portfolioId === portfolioId)), 0)
  return () => {
    if (_listeners.positions[portfolioId]) {
      _listeners.positions[portfolioId] = _listeners.positions[portfolioId].filter(fn => fn !== callback)
    }
  }
}

export async function addPosition(portfolioId, userId, data) {
  const id = uid()
  _positions.push({
    id, portfolioId, userId,
    ...data,
    shares:   parseFloat(data.shares),
    avgCost:  parseFloat(data.avgCost),
    beta:     data.beta   ? parseFloat(data.beta)   : 1,
    low52w:   data.low52w ? parseFloat(data.low52w)  : null,
    high52w:  data.high52w? parseFloat(data.high52w) : null,
    addedAt: { seconds: Date.now() / 1000 }
  })
  notifyPositions(portfolioId)
  return { id }
}

export async function updatePosition(id, data) {
  _positions = _positions.map(p => p.id === id ? {
    ...p, ...data,
    shares:  parseFloat(data.shares),
    avgCost: parseFloat(data.avgCost),
    beta:    data.beta   ? parseFloat(data.beta)   : p.beta,
    low52w:  data.low52w ? parseFloat(data.low52w)  : p.low52w,
    high52w: data.high52w? parseFloat(data.high52w) : p.high52w,
  } : p)
  const pos = _positions.find(p => p.id === id)
  if (pos) notifyPositions(pos.portfolioId)
}

export async function deletePosition(id) {
  const pos = _positions.find(p => p.id === id)
  _positions = _positions.filter(p => p.id !== id)
  if (pos) notifyPositions(pos.portfolioId)
}

// ── JOURNAL ──────────────────────────────────────────────────────────────────

export function subscribeJournal(userId, callback) {
  _listeners.journal.push(callback)
  const sorted = [..._journal].sort((a, b) => b.createdAt.seconds - a.createdAt.seconds)
  setTimeout(() => callback(sorted), 0)
  return () => {
    _listeners.journal = _listeners.journal.filter(fn => fn !== callback)
  }
}

export async function addJournalEntry(userId, data) {
  const id = uid()
  _journal.push({ id, userId, createdAt: { seconds: Date.now() / 1000 }, ...data })
  notifyJournal()
  return { id }
}

export async function updateJournalEntry(id, data) {
  _journal = _journal.map(e => e.id === id ? { ...e, ...data } : e)
  notifyJournal()
}

export async function deleteJournalEntry(id) {
  _journal = _journal.filter(e => e.id !== id)
  notifyJournal()
}

// ── SNAPSHOTS ─────────────────────────────────────────────────────────────────

export async function saveSnapshot(portfolioId, userId, totalValue) {
  const today = new Date().toISOString().split('T')[0]
  _snapshots.push({ id: uid(), portfolioId, userId, totalValue, date: today, savedAt: { seconds: Date.now() / 1000 } })
}

export async function getSnapshots(portfolioId) {
  return _snapshots.filter(s => s.portfolioId === portfolioId)
}

// ── TRADE HISTORY ─────────────────────────────────────────────────────────────

export async function addTradeHistory(userId, data) {
  const id = uid()
  _tradeHistory.unshift({ id, userId, closedAt: { seconds: Date.now() / 1000 }, ...data })
  const sorted = [..._tradeHistory].sort((a, b) => b.closedAt.seconds - a.closedAt.seconds)
  _listeners.tradeHistory.forEach(fn => fn(sorted))
  return { id }
}

export function subscribeTradeHistory(userId, callback) {
  _listeners.tradeHistory.push(callback)
  const sorted = [..._tradeHistory].sort((a, b) => b.closedAt.seconds - a.closedAt.seconds)
  setTimeout(() => callback(sorted), 0)
  return () => {
    _listeners.tradeHistory = _listeners.tradeHistory.filter(fn => fn !== callback)
  }
}