import { useEffect, useState } from 'react'
import TileHead from '../components/TileHead.jsx'
import Sparkline from '../components/Sparkline.jsx'
import { api } from '../lib/api.js'
import { useLive } from '../lib/useLive.js'

function QualityMeter({ quality, reliable }) {
  const pct = Math.round((quality ?? 0) * 100)
  return (
    <div style={{ width: '100%', maxWidth: 360 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
        <span>Reading quality</span>
        <strong>{quality == null ? '—' : reliable ? 'Good' : 'Too low to read'}</strong>
      </div>
      <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Reading quality"
        style={{ height: 10, borderRadius: 999, background: '#fff', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: reliable ? 'var(--brand)' : '#C9A227', transition: 'width .3s' }} />
      </div>
      <p className="muted" style={{ margin: '8px 0 0' }}>Sit still, face the camera, with light on your face.</p>
    </div>
  )
}

// The SDK's tips are written for Presage's own app (which has a record button).
// BipolarBird measures automatically during a session, so reword the ones that don't fit.
const HINT_TEXT = {
  'Hold still and record.': 'Looking good. Hold still while we measure.',
  'Hold still and record': 'Looking good. Hold still while we measure.',
}
const friendlyHint = (h) => HINT_TEXT[h] ?? h

function Preview({ frame, hint }) {
  return (
    <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ position: 'relative', aspectRatio: '16 / 9', borderRadius: 16, overflow: 'hidden', background: '#0A0A0A' }}>
        {frame
          ? <img src={`data:image/jpeg;base64,${frame}`} alt="Live camera preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#bbb', fontSize: 14 }}>Starting camera…</span>}
        <span style={{ position: 'absolute', top: 10, left: 10, padding: '2px 10px', borderRadius: 999, background: 'rgba(10,10,10,.7)', color: '#fff', fontSize: 12, fontWeight: 600 }}>
          Live · not recorded
        </span>
      </div>
      {hint && <p role="status" style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{friendlyHint(hint)}</p>}
    </div>
  )
}

const WARMUP_S = 30

function useElapsed(startedAt) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!startedAt) return undefined
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [startedAt])
  return startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function SessionClock({ elapsed, measuring }) {
  const warm = Math.min(1, elapsed / WARMUP_S)
  return (
    <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 15 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 999, background: '#2563EB', animation: 'pulse-dot 1.2s ease-in-out infinite' }} />
          {measuring ? 'Measuring live' : 'Warming up'}
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{mmss(elapsed)}</span>
      </div>
      {!measuring && (
        <>
          <div style={{ height: 6, borderRadius: 999, background: '#fff', overflow: 'hidden' }}>
            <div style={{ width: `${warm * 100}%`, height: '100%', background: '#2563EB', transition: 'width .5s linear' }} />
          </div>
          <span className="muted">
            {elapsed < WARMUP_S
              ? `First numbers in about ${WARMUP_S - elapsed}s. The waves below are live already.`
              : 'Almost there. Hold still and keep your face and chest in view.'}
          </span>
        </>
      )}
    </div>
  )
}

function LiveSignal({ traces }) {
  const waves = [
    ['Pulse wave', traces.pulse, '#2563EB'],
    ['Breathing wave', traces.breathing, '#0A0A0A'],
  ]
  return (
    <section className="tile" style={{ background: '#fff', border: '1px solid #e5e5e5', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 18 }}>Live signal</h2>
        <span className="muted">Raw waves from the camera, shown live and not saved</span>
      </div>
      {waves.map(([label, values, color]) => (
        <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
          {values.length > 1
            ? <Sparkline values={values} width={600} height={64} color={color} pad="auto" />
            : <span className="muted" style={{ height: 64, display: 'flex', alignItems: 'center' }}>Waiting for signal…</span>}
        </div>
      ))}
    </section>
  )
}

// How settled the last ~10 good readings are. `tight`/`loose` are max-min spreads.
function steadiness(series, tight, loose) {
  const recent = series.filter((v) => v != null).slice(-10)
  if (recent.length < 5) return null
  const spread = Math.max(...recent) - Math.min(...recent)
  if (spread <= tight) return { text: 'Steady reading', color: 'var(--brand-ink)' }
  if (spread <= loose) return { text: 'Settling', color: '#8A6D00' }
  return { text: 'Jumping around: hold still', color: '#A33' }
}

function Metric({ label, unit, value, series, tight, loose }) {
  const steady = steadiness(series, tight, loose)
  return (
    <section className="tile" style={{ flex: '1 1 260px', background: '#fff', padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
      <span style={{ font: '600 48px/1 var(--body)', letterSpacing: '-.02em' }}>
        {value == null ? <span style={{ fontSize: 28, color: 'var(--muted)' }}>No reading</span> : <>{Math.round(value)} <small style={{ fontSize: 18 }}>{unit}</small></>}
      </span>
      {steady && <span style={{ fontSize: 14, fontWeight: 600, color: steady.color }}>{steady.text}</span>}
      <Sparkline values={series} />
    </section>
  )
}

export default function Camera() {
  const { sidecar, active, readings, lastSession, frame, hint, traces, startedAt } = useLive()
  const elapsed = useElapsed(active ? startedAt : null)
  const measuring = readings.some((r) => r.reliable)
  const [error, setError] = useState(null)
  const last = readings.at(-1)

  const run = (path) => async () => {
    setError(null)
    try { await api.post(path) } catch (e) { setError(e.message) }
  }

  return (
    <>
      <header className="page-header">
        <h1>Camera session</h1>
        <p className="lede">Contactless heart-rate and breathing readings. The camera is only on while a session runs. You see a live preview, but video is never recorded or saved. Only the numbers are kept.</p>
        <div className="meta">
          <span>{sidecar ? 'Camera service ready' : 'Camera service not running'}</span>
          <span>{active ? 'Camera is on' : 'Camera is off'}</span>
        </div>
      </header>

      <section className="tile" style={{ background: 'var(--lavender)', padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
        <TileHead kicker="About a minute" title={active ? 'Session running' : 'Ready when you are'} tilt={2} />
        {active && <SessionClock elapsed={elapsed} measuring={measuring} />}
        {active && <Preview frame={frame} hint={hint} />}
        {active && <QualityMeter quality={last?.quality} reliable={last?.reliable} />}
        <div style={{ display: 'flex', gap: 8 }}>
          {active
            ? <button className="btn btn-dark" onClick={run('/api/sessions/stop')}>Stop session</button>
            : <button className="btn btn-dark" onClick={run('/api/sessions/start')} disabled={!sidecar}>Start a session</button>}
        </div>
        {!sidecar && <p className="muted" style={{ margin: 0 }}>Start the sidecar: <code>cd sidecar && python run_sidecar.py</code></p>}
        {error && <p className="error">{error}</p>}
      </section>

      {active && <LiveSignal traces={traces} />}

      {(active || readings.length > 0) && (
        <div className="row">
          <Metric label="Heart rate" unit="bpm" value={last?.heart_rate} series={readings.map((r) => r.heart_rate)} tight={5} loose={10} />
          <Metric label="Breathing" unit="breaths/min" value={last?.breathing_rate} series={readings.map((r) => r.breathing_rate)} tight={2} loose={4} />
        </div>
      )}

      {lastSession && (
        <section className="tile" style={{ background: 'var(--mint)', padding: 24 }}>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Session saved</h2>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            {lastSession.good_readings > 0
              ? `Typical heart rate ${Math.round(lastSession.avg_heart_rate)} bpm and breathing ${Math.round(lastSession.avg_breathing_rate)} per minute, from ${lastSession.good_readings} of ${lastSession.total_readings} readings with good quality.`
              : 'No reliable readings this time. Try again with more light and less movement.'}
          </p>
        </section>
      )}
    </>
  )
}
