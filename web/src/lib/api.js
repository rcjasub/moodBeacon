import { clearToken, getToken } from './auth.js'

const BASE = import.meta.env.VITE_API_URL || ''

async function request(method, path, body) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  // Expired or missing login: drop the token so the app shows the login page.
  if (res.status === 401 && !path.startsWith('/api/auth/')) clearToken()
  if (!res.ok) {
    let detail = res.statusText
    try { detail = (await res.json()).detail || detail } catch { /* not json */ }
    throw new Error(detail)
  }
  return res.json()
}

export const api = {
  get: (p) => request('GET', p),
  put: (p, b) => request('PUT', p, b),
  post: (p, b) => request('POST', p, b),
  del: (p) => request('DELETE', p),
}

export function liveSocketUrl() {
  const base = BASE || window.location.origin
  const token = getToken()
  return base.replace(/^http/, 'ws') + '/ws/live' + (token ? `?token=${encodeURIComponent(token)}` : '')
}
