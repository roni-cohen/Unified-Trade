// src/lib/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { IS_DEMO, auth } from './firebase'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth'

const AuthContext = createContext(null)
const DEMO_USER = { uid: 'demo', email: 'demo@portfolioos.app', displayName: 'Demo User' }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading

  useEffect(() => {
    if (IS_DEMO) {
      setUser(DEMO_USER)
      return
    }
    // auth is guaranteed non-null here because IS_DEMO is false
    const unsub = onAuthStateChanged(auth, u => setUser(u || null))
    return unsub // properly return cleanup
  }, [])

  const login = (email, password) => {
    if (IS_DEMO) { setUser(DEMO_USER); return Promise.resolve() }
    return signInWithEmailAndPassword(auth, email, password)
  }

  const register = (email, password) => {
    if (IS_DEMO) { setUser(DEMO_USER); return Promise.resolve() }
    return createUserWithEmailAndPassword(auth, email, password)
  }

  const logout = () => {
    if (IS_DEMO) { setUser(null); return Promise.resolve() }
    return signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading: user === undefined, isDemo: IS_DEMO }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
