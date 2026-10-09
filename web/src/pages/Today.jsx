import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import StrokeText from '../components/StrokeText/StrokeText.jsx'
import CheckinForm from '../components/CheckinForm.jsx'
import FollowUpCard from '../components/FollowUpCard.jsx'
import TileHead from '../components/TileHead.jsx'
import { api } from '../lib/api.js'
import { longDate, relativeTime } from '../lib/format.js'

export default function Today() {
  const [status, setStatus] = useState(null)
  const [prompts, setPrompts] = useState([])
  const [error, setError] = useState(null)

  const refresh = useCallback(() => {
    Promise.all([api.get('/api/status'), api.get('/api/prompts/active')])
      .then(([s, p]) => { setStatus(s); setPrompts(p); setError(null) })
      .catch(() => setError('Cannot reach the BipolarBird API. Is it running on port 8000?'))
  }, [])

  useEffect(refresh, [refresh])

  const lastCheckin = relativeTime(status?.last_checkin)
  const camera = status?.active_session ? 'Camera is on' : 'Camera is off'

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <h1 className="stroke-title">
            <TitleLine text="Notice changes." />
            <span className="stroke-title__row">
              <Logo size={48} style={{ flex: 'none', transform: 'rotate(12deg)' }} />
              <TitleLine text="Understand patterns." />
            </span>
          </h1>
          <p className="lede">A private companion for tracking sleep, mood and energy, so you can decide what to do next. It does not diagnose or predict episodes.</p>
        </div>
        <div className="meta">
          <span>{longDate()}</span>
          <span>{lastCheckin ? `Last check-in ${lastCheckin}` : 'No check-ins yet'}</span>
          <span>{camera}</span>
          {status?.has_sample && <span className="sample-badge">Sample data loaded</span>}
        </div>
        {error && <p className="error">{error}</p>}
      </header>

      <div className="row">
        <CheckinForm onSaved={refresh} />

        <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section className="tile" aria-labelledby="cs" style={{ background: 'var(--lavender)', padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
            <TileHead id="cs" kicker="About a minute" title="Camera session" tilt={4} />
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, maxWidth: 300 }}>
              The camera is only on while you run a session.{' '}
              {status?.last_session_today ? 'You ran a session today.' : 'No session yet today.'}
            </p>
            <Link className="btn btn-dark" to="/camera">Start a session</Link>
          </section>

          {prompts.map((p) => <FollowUpCard key={p.id} prompt={p} onDone={refresh} />)}
        </div>
      </div>

      <div className="grid3">
        <LinkTile to="/timeline" cls="r1" bg="var(--pink)" tilt={-3} kicker="Charts and notes" title="Timeline"
          text="Sleep and check-ins on one chart, camera readings on another." />
        <LinkTile to="/privacy" cls="r2" bg="var(--lavender)" tilt={3} kicker="You are in control" title="Privacy and data"
          text="Video is never saved. Export or delete anything, any time." />
        <LinkTile to="/plan" cls="r3" bg="var(--page)" tilt={-2} kicker="Written with your care team" title="Wellness plan"
          text="Shown whenever a follow-up prompt appears." />
      </div>
    </>
  )
}

// Headline line: blue outline draws in, then a black fill wipes across.
function TitleLine({ text }) {
  return (
    <StrokeText
      text={text}
      align="left"
      strokeColor="#2563EB"
      fillColor="#0A0A0A"
      strokeWidth={1.2}
      fontSize={56}
      fontWeight={600}
      letterSpacing={-1.4}
      drawDuration={1.6}
      fillDelay={0.2}
      stagger={0.04}
      className="stroke-title__line"
    />
  )
}

function LinkTile({ to, cls, bg, tilt, kicker, title, text }) {
  return (
    <Link className={`tile ${cls}`} to={to} style={{ background: bg, minHeight: 200, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center' }}>
      <span style={{ transform: `rotate(${tilt}deg)`, fontSize: 15 }}>{kicker}</span>
      <span className="pill" style={{ transform: `rotate(${tilt}deg)` }}>{title}</span>
      <span style={{ fontSize: 14, maxWidth: 240, lineHeight: 1.45 }}>{text}</span>
    </Link>
  )
}
