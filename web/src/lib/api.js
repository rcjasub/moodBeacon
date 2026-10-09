const BASE = import.meta.env.VITE_API_URL || ''

async function request(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
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
  return base.replace(/^http/, 'ws') + '/ws/live'
}
