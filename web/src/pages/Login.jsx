import { useState } from 'react'
import Logo from '../components/Logo.jsx'
import TileHead from '../components/TileHead.jsx'
import { api } from '../lib/api.js'
import { setToken } from '../lib/auth.js'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await api.post('/api/auth/login', { username, password })
      setToken(res.token)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Logo size={40} />
        <span style={{ font: '600 26px var(--display)' }}>BipolarBird</span>
      </div>
      <form className="tile" onSubmit={submit} style={{ width: '100%', maxWidth: 400, background: 'var(--sun)', padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <TileHead kicker="Private" title="Log in" tilt={-2} align="start" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor="user" className="label">Username</label>
          <input id="user" className="input" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor="pass" className="label">Password</label>
          <input id="pass" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-dark" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
      </form>
      <p className="muted" style={{ textAlign: 'center', maxWidth: 400 }}>Your check-ins and readings are only visible after logging in.</p>
    </div>
  )
}
