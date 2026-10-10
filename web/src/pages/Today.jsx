import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import FoldText from '../components/FoldText/FoldText.jsx'
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
          <h1 className="fold-title">
            <TitleLine text="Notice changes." />
            <span className="fold-title__row">
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
          <section className="tile" aria-labelledby="cs" style={{ flex: 1, background: 'var(--lavender)', padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center' }}>
            <TileHead id="cs" kicker="About a minute" title="Camera session" tilt={4} />
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, maxWidth: 300 }}>
              The camera is only on while you run a session.{' '}
              {status?.last_session_today ? 'You ran a session today.' : 'No session yet today.'}
            </p>
            <Link className="btn btn-dark" to="/camera">Start a session</Link>
          </section>

          {prompts.map((p) => <FollowUpCard key={p.id} prompt={p} onDone={refresh} />)}

          <LinkTile to="/let-it-go" cls="r3" bg="var(--pink)" tilt={-2} kicker="Write it, crumple it" title="Let it go"
            text="Put a thought on paper, then throw it away." style={{ flex: 1 }} />
        </div>
      </div>

      <div className="grid2">
        <LinkTile to="/timeline" cls="r1" bg="var(--butter)" tilt={-3} kicker="Charts" title="Timeline"
          text="Sleep and check-ins on one chart, camera readings on another." />
        <LinkTile to="/privacy" cls="r2" bg="var(--page)" tilt={3} kicker="You are in control" title="Privacy and data"
          text="Video is never saved. Export or delete anything, any time." />
      </div>
    </>
  )
}

// Headline line: letters fold down into place.
function TitleLine({ text }) {
  return (
    <FoldText
      text={text}
      hinge="top"
      fontSize="clamp(22px, 7.2vw, 56px)"
      fontWeight={600}
      color="#0A0A0A"
      duration={0.7}
      stagger={0.035}
      className="fold-title__line"
    />
  )
}

function LinkTile({ to, cls, bg, tilt, kicker, title, text, style }) {
  return (
    <Link className={`tile ${cls}`} to={to} style={{ background: bg, minHeight: 200, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', ...style }}>
      <span style={{ transform: `rotate(${tilt}deg)`, fontSize: 15 }}>{kicker}</span>
      <span className="pill" style={{ transform: `rotate(${tilt}deg)` }}>{title}</span>
      <span style={{ fontSize: 14, maxWidth: 240, lineHeight: 1.45 }}>{text}</span>
    </Link>
  )
}
