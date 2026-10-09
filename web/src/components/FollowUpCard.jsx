import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import TileHead from './TileHead.jsx'

export default function FollowUpCard({ prompt, onDone }) {
  const act = async (action) => {
    await api.post(`/api/prompts/${prompt.id}`, { action })
    onDone?.()
  }

  return (
    <section className="tile" aria-labelledby="fu" style={{ background: 'var(--butter)', border: '1px solid var(--butter-line)', padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
      <TileHead id="fu" kicker="From your own check-ins" title="Worth a look" tilt={-3} />
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, maxWidth: 320 }}>{prompt.message}</p>
      {prompt.is_sample && <span className="sample-badge">Sample data</span>}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
        <Link className="btn btn-dark" to="/timeline" onClick={() => act('review')}>Review my week</Link>
        <Link className="btn" to="/plan">Wellness plan</Link>
        <Link className="btn" to="/plan#clinician">Contact clinician</Link>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button type="button" className="btn btn-quiet" onClick={() => act('snooze')}>Remind me tomorrow</button>
        <button type="button" className="btn btn-quiet" onClick={() => act('dismiss')}>Dismiss</button>
      </div>
    </section>
  )
}
