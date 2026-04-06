// src/hooks/useLivePrices.js
import { useState, useEffect, useCallback } from 'react'
import { fetchPrices } from '../lib/stockApi'

export function useLivePrices(tickers = [], refreshMs = 60000) {
  const [prices, setPrices] = useState({})
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  const refresh = useCallback(async () => {
    if (!tickers.length) return
    setLoading(true)
    try {
      const data = await fetchPrices(tickers)
      setPrices(data)
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
    }
  }, [tickers.join(',')])

  useEffect(() => {
    refresh()
    if (!refreshMs) return
    const id = setInterval(refresh, refreshMs)
    return () => clearInterval(id)
  }, [refresh, refreshMs])

  return { prices, loading, lastUpdated, refresh }
}
