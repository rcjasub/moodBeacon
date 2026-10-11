// Login token, kept in this browser. Anything that changes it tells subscribers (App re-renders).
const KEY = 'bipolarbird-token'
const listeners = new Set()

export function getToken() {
  try { return localStorage.getItem(KEY) } catch { return null }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(KEY, token)
    else localStorage.removeItem(KEY)
  } catch { /* storage blocked: the login just won't survive a reload */ }
  listeners.forEach((fn) => fn(token))
}

export const clearToken = () => setToken(null)

export function onTokenChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
