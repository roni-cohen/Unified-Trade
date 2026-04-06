// src/hooks/usePortfolios.js
import { useState, useEffect } from 'react'
import { subscribePortfolios } from '../lib/db'
import { useAuth } from '../lib/AuthContext'

export function usePortfolios() {
  const { user } = useAuth()
  const [portfolios, setPortfolios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    setError(null)

    try {
      const unsub = subscribePortfolios(user.uid, data => {
        setPortfolios(data)
        setLoading(false)
      })
      // Handle Firestore returning an error unsubscriber (missing index etc.)
      if (typeof unsub === 'function') return unsub
    } catch (err) {
      console.error('subscribePortfolios error:', err)
      setError(err.message)
      setLoading(false)
    }
  }, [user?.uid])

  return { portfolios, loading, error }
}
