import { useEffect, useState } from 'react'
import { api } from './api.js'
import { clearToken, getToken, onTokenChange } from './auth.js'

/** 'checking' | 'in' | 'out'. Also whether login is turned on for this API at all. */
export function useAuth() {
  const [state, setState] = useState('checking')
  const [enabled, setEnabled] = useState(false)
  const [token, setTok] = useState(getToken())

  useEffect(() => onTokenChange(setTok), [])

  useEffect(() => {
    let cancelled = false
    const done = (s) => { if (!cancelled) setState(s) }
    api.get('/api/auth/status')
      .then(async ({ enabled: on }) => {
        if (cancelled) return
        setEnabled(on)
        if (!on) return done('in')
        if (!token) return done('out')
        try { await api.get('/api/auth/me'); done('in') } catch { clearToken(); done('out') }
      })
      .catch(() => done('in')) // API unreachable: let the pages show their own "cannot reach" errors
    return () => { cancelled = true }
  }, [token])

  return { state, enabled, logout: clearToken }
}
