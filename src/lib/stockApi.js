// src/lib/stockApi.js
const CACHE = new Map()
const CACHE_TTL = 60_000
const NEWS_CACHE = new Map()
const NEWS_TTL = 300_000 // 5 minutes

function yahooUrl(ticker, interval, range) {
  return `/api/yahoo/v8/finance/chart/${ticker}?interval=${interval}&range=${range}`
}

async function fetchYahoo(ticker, interval, range) {
  const res = await fetch(yahooUrl(ticker, interval, range))
  return res.json()
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
    if (r.status === 'fulfilled' && r.value) map[tickers[i].toUpperCase()] = r.value
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

export async function fetchTickerNews(ticker) {
  const key = ticker.toUpperCase()
  const cached = NEWS_CACHE.get(key)
  if (cached && Date.now() - cached.ts < NEWS_TTL) return cached.data

  try {
    const res = await fetch(`/api/yahoo/v1/finance/search?q=${key}&newsCount=6&quotesCount=0`)
    const json = await res.json()
    const news = (json?.news || []).map(item => ({
      title: item.title,
      url: item.link,
      publisher: item.publisher,
      publishedAt: item.providerPublishTime ? new Date(item.providerPublishTime * 1000) : null,
      thumbnail: item.thumbnail?.resolutions?.[0]?.url || null,
      uuid: item.uuid,
    })).filter(n => n.title && n.url)

    NEWS_CACHE.set(key, { data: news, ts: Date.now() })
    return news
  } catch (err) {
    console.warn(`News fetch failed for ${key}:`, err.message)
    return []
  }
}

export async function fetchTickerProfile(ticker) {
  const key = ticker.toUpperCase()
  try {
    const res = await fetch(`/api/yahoo/v1/finance/search?q=${key}&quotesCount=1&newsCount=0&enableFuzzyQuery=false`)
    const json = await res.json()
    const quote = json?.quotes?.[0]
    if (!quote) return null
    return {
      name: quote.longname || quote.shortname || key,
      exchange: quote.exchange,
      type: quote.quoteType,
      sector: quote.sector || null,
      industry: quote.industry || null,
    }
  } catch (err) {
    return null
  }
}

export async function fetchTickerDescription(ticker) {
  const key = ticker.toUpperCase()
  try {
    // Use the search endpoint (already works) just to get the full name
    const searchRes = await fetch(`/api/yahoo/v1/finance/search?q=${key}&quotesCount=1&newsCount=0`)
    const searchJson = await searchRes.json()
    const q = searchJson?.quotes?.[0]
    const fullName = q?.longname || q?.shortname || key
    const quoteType = q?.quoteType || null

    // Strip legal suffixes for a cleaner Wikipedia match
    const wikiQuery = fullName
      .replace(/\s+(Inc\.?|Corp\.?|Ltd\.?|LLC|PLC|ETF|Fund|Trust|N\.?V\.?|S\.?A\.?)$/i, '')
      .trim()

    // Try full name first, then ticker symbol as fallback
    for (const query of [wikiQuery, key]) {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
      )
      if (res.ok) {
        const wiki = await res.json()
        if (wiki.extract && wiki.type !== 'disambiguation') {
          return {
            description: wiki.extract,
            wikiUrl: wiki.content_urls?.desktop?.page || null,
            thumbnail: wiki.thumbnail?.source || null,
            name: fullName,
            type: quoteType,
          }
        }
      }
    }

    // Wikipedia found nothing — return name/type only
    if (q) return { description: null, wikiUrl: null, thumbnail: null, name: fullName, type: quoteType }
    return null
  } catch (err) {
    console.warn(`Description fetch failed for ${key}:`, err.message)
    return null
  }
}