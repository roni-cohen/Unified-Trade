// src/lib/stockApi.js
const CACHE = new Map()
const CACHE_TTL = 60_000

function yahooUrl(ticker, interval, range) {
  return `/api/yahoo/v8/finance/chart/${ticker}?interval=${interval}&range=${range}`
}

async function fetchYahoo(ticker, interval, range) {
  
  
  try {
    const res = await fetch(yahooUrl(ticker, interval, range))

    // Check if the response is successful and is JSON
    if (!res.ok || !res.headers.get("content-type")?.includes("application/json")) {
      throw new Error(`HTTP error! status: ${res.status} or not JSON`);
    }
    return await res.json();
  } catch (e) {
    // This matches your existing error handling pattern
    return console.warn(`Failed to fetch ${e}:`, a.message), null;
  }
}

export async function fetchPrice(ticker) {
  const key = ticker.toUpperCase()
  const cached = CACHE.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

  try {
    const json = await fetchYahoo(key, '1d', '1d')
    const meta = json?.chart?.result?.[0]?.meta
    if (!meta) throw new Error('No data')

    const prev = meta.previousClose || meta.chartPreviousClose
    const data = {
      ticker: key,
      price: meta.regularMarketPrice,
      previousClose: prev,
      change: prev ? meta.regularMarketPrice - prev : 0,
      changePercent: prev ? ((meta.regularMarketPrice - prev) / prev) * 100 : 0,
      currency: meta.currency,
      name: meta.longName || meta.shortName || key,
      exchange: meta.exchangeName,
      marketState: meta.marketState,
    }

    CACHE.set(key, { data, ts: Date.now() })
    return data
  } catch (err) {
    console.warn(`Failed to fetch ${key}:`, err.message)
    return null
  }
}

export async function fetchPrices(tickers) {
  const results = await Promise.allSettled(tickers.map(fetchPrice))
  const map = {}
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      map[tickers[i].toUpperCase()] = r.value
    }
  })
  return map
}

export async function fetchHistoricalData(ticker, range = '1y') {
  const key = ticker.toUpperCase()
  const intervals = { '1w': '1d', '1m': '1d', '3m': '1d', '6m': '1wk', '1y': '1wk', '5y': '1mo' }
  const interval = intervals[range] || '1d'

  try {
    const json = await fetchYahoo(key, interval, range)
    const result = json?.chart?.result?.[0]
    if (!result) return []

    const timestamps = result.timestamp || []
    const closes = result.indicators?.quote?.[0]?.close || []

    return timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      price: closes[i] ? Math.round(closes[i] * 100) / 100 : null,
    })).filter(d => d.price !== null)
  } catch (err) {
    console.warn(`Historical fetch failed for ${key}:`, err.message)
    return []
  }
}