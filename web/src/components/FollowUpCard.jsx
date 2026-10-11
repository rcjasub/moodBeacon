import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import NotifyPanel from './NotifyPanel.jsx'
import TileHead from './TileHead.jsx'

export default function FollowUpCard({ prompt, onDone }) {
  const [notifying, setNotifying] = useState(false)
  const act = async (action) => {
    await api.post(`/api/prompts/${prompt.id}`, { action })
    onDone?.()
  }

  return (
    <section className="tile" aria-labelledby="fu" style={{ background: 'var(--butter)', padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
      <TileHead id="fu" kicker={prompt.rule_id === 'hr_sustained' ? 'From your camera sessions' : 'From your own check-ins'} title="Worth a look" tilt={-3} />
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, maxWidth: 320 }}>{prompt.message}</p>
      {prompt.is_sample && <span className="sample-badge">Sample data</span>}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
        <Link className="btn btn-dark" to="/timeline" onClick={() => act('review')}>Review my week</Link>
        <Link className="btn" to="/plan">Wellness plan</Link>
        <button type="button" className="btn" onClick={() => setNotifying((v) => !v)} aria-expanded={notifying}>Let my people know</button>
      </div>
      {notifying && <NotifyPanel prompt={prompt} onClose={() => setNotifying(false)} />}
      <div style={{ display: 'flex', gap: 4 }}>
        <button type="button" className="btn btn-quiet" onClick={() => act('snooze')}>Remind me tomorrow</button>
        <button type="button" className="btn btn-quiet" onClick={() => act('dismiss')}>Dismiss</button>
      </div>
    </section>
  )
}
