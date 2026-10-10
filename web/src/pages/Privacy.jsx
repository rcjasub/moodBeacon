import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TileHead from '../components/TileHead.jsx'
import { api } from '../lib/api.js'

export default function Privacy() {
  const [status, setStatus] = useState(null)
  const [msg, setMsg] = useState(null)

  const refresh = () => api.get('/api/status').then(setStatus).catch(() => {})
  useEffect(() => { refresh() }, [])

  const exportData = async () => {
    const data = await api.get('/api/data/export')
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `bipolarbird-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const removeSample = async () => {
    await api.del('/api/data/sample')
    setMsg('Sample data removed.')
    refresh()
  }

  const deleteAll = async () => {
    if (!window.confirm('Delete all check-ins, camera readings, prompts, let-it-go notes and your wellness plan? This cannot be undone.')) return
    await api.del('/api/data')
    setMsg('All your data has been deleted.')
    refresh()
  }

  return (
    <>
      <header className="page-header">
        <h1>Privacy and data</h1>
        <p className="lede">You are in control. Everything stays in your own database, and nothing is shared unless you choose to.</p>
      </header>

      <div className="grid3">
        <Fact bg="var(--lavender)" title="Video is never saved" text="Camera frames are processed live on this computer. A small preview is shown only to you while a session runs. Only heart rate, breathing and a quality score are stored." />
        <Fact bg="var(--mint)" title="No diagnosis" text="BipolarBird does not diagnose, score risk or predict episodes. Follow-ups come from simple rules on your own check-ins." />
        <Fact bg="var(--pink)" title="Nothing shared" text="There is no sharing feature. If summaries are turned on, only a few counts (never notes) are sent to Gemini for wording, for the weekly summary and appointment brief." />
      </div>

      <section className="tile" style={{ background: 'var(--page)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <TileHead kicker="Any time" title="Your data" tilt={-1} align="start" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button className="btn btn-dark" onClick={exportData}>Export everything (JSON)</button>
          {status?.has_sample && <button className="btn" onClick={removeSample}>Remove sample data</button>}
          <Link className="btn" to="/plan">Edit wellness plan</Link>
          <button className="btn btn-danger" onClick={deleteAll}>Delete all my data</button>
        </div>
        {msg && <p role="status" style={{ margin: 0 }}>{msg}</p>}
        {status && (
          <p className="muted" style={{ margin: 0 }}>
            Gemini wording: {status.gemini_enabled ? 'on' : 'off (no API key set)'} · Camera service: {status.sidecar_connected ? 'connected' : 'not running'}
          </p>
        )}
      </section>
    </>
  )
}

function Fact({ bg, title, text }) {
  return (
    <section className="tile" style={{ background: bg, padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h2 style={{ fontSize: 20 }}>{title}</h2>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{text}</p>
    </section>
  )
}
