import { useState } from 'react'
import TileHead from './TileHead.jsx'
import { api } from '../lib/api.js'

const PERIODS = [14, 30, 90]

// Brief to bring to an appointment. Only built when asked, so nothing is sent to Gemini otherwise.
export default function AppointmentPrep() {
  const [days, setDays] = useState(30)
  const [brief, setBrief] = useState(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)

  const prepare = async () => {
    setBusy(true)
    setStatus(null)
    try {
      setBrief(await api.get(`/api/appointment?days=${days}`))
    } catch (err) {
      setStatus(`Could not prepare: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const asText = () => [
    `Appointment brief: last ${brief.days} days`,
    '', brief.brief,
    '', 'The numbers:', ...brief.facts.map((f) => `- ${f}`),
    '', 'Questions I might ask:', ...brief.questions.map((q) => `- ${q}`),
  ].join('\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText())
      setStatus('Copied.')
    } catch {
      setStatus('Could not copy. Select the text instead.')
    }
  }

  return (
    <section className="tile" aria-labelledby="appt" style={{ background: 'var(--lavender)', padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <TileHead id="appt" kicker="Before you see your clinician" title="Prepare for my appointment" tilt={1} align="start" />
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, maxWidth: 640 }}>
        A short brief built from your check-ins and camera sessions, plus a few questions you might want to ask.
        Only counts and averages are used, never your notes.
      </p>

      <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span className="label" style={{ marginRight: 4 }}>Period</span>
        {PERIODS.map((d) => (
          <button key={d} type="button" className="chip" aria-pressed={days === d} onClick={() => setDays(d)}>Last {d} days</button>
        ))}
        <button type="button" className="btn btn-dark" onClick={prepare} disabled={busy} style={{ marginLeft: 8 }}>
          {busy ? 'Preparing…' : brief ? 'Prepare again' : 'Prepare brief'}
        </button>
      </div>

      {brief && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55 }}>{brief.brief}</p>
          <div>
            <h3 style={{ fontSize: 15, marginBottom: 8 }}>The numbers</h3>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 15 }}>
              {brief.facts.map((f) => <li key={f}>{f}</li>)}
            </ul>
          </div>
          <div>
            <h3 style={{ fontSize: 15, marginBottom: 8 }}>Questions you might ask</h3>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 15 }}>
              {brief.questions.map((q) => <li key={q}>{q}</li>)}
            </ul>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {brief.source === 'gemini' ? 'Worded by Gemini from the numbers above. ' : ''}
            Based only on your own entries. It does not diagnose or predict anything.
          </p>
          <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="btn" onClick={copy}>Copy</button>
            <button type="button" className="btn" onClick={() => window.print()}>Print</button>
          </div>
        </div>
      )}
      {status && <p role="status" className="muted" style={{ margin: 0 }}>{status}</p>}
    </section>
  )
}
