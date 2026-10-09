import { useEffect, useMemo, useState } from 'react'
import TileHead from '../components/TileHead.jsx'
import { api } from '../lib/api.js'
import { ENERGIES, MOODS, labelOf, shortDay, todayISO } from '../lib/format.js'

const DAYS = 14
const MOOD_Y = { low: 0, slightly_low: 1, steady: 2, lifted: 3, very_high: 4 }

function lastNDays(n) {
  const today = new Date(todayISO() + 'T00:00:00')
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (n - 1 - i))
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  })
}

const W = 720
const PAD = 34 // left gutter for axis labels
const COL = (W - PAD) / DAYS
const colX = (i) => PAD + i * COL

function DayAxis({ days, y }) {
  return days.map((d, i) => (i % 2 === 0 || i === days.length - 1) && (
    <text key={d} x={colX(i) + COL / 2} y={y} textAnchor="middle" fontSize="11" fill="#555">{shortDay(d)}</text>
  ))
}

function ReportedChart({ days, byDay }) {
  const H = 180
  const sy = (h) => H - (h / 12) * H
  return (
    <svg viewBox={`0 0 ${W} ${H + 110}`} width="100%" role="img" aria-label="Sleep hours and mood by day">
      {[4, 6, 8, 10].map((h) => (
        <g key={h}>
          <line x1={PAD} x2={W} y1={sy(h)} y2={sy(h)} stroke="#cfdcd6" strokeDasharray="3 4" />
          <text x={PAD - 6} y={sy(h) + 3} textAnchor="end" fontSize="10" fill="#2B3A33">{h}h</text>
        </g>
      ))}
      {days.map((d, i) => {
        const c = byDay[d]
        const x = colX(i)
        if (!c) return <text key={d} x={x + COL / 2} y={H - 4} textAnchor="middle" fontSize="11" fill="#999">·</text>
        const flags = ['racing_thoughts', 'irritable', 'unusual_activity', 'less_sleep_need'].filter((f) => c[f])
        return (
          <g key={d}>
            <title>{`${shortDay(d)}: ${c.sleep_hours ?? '?'}h sleep, mood ${labelOf(MOODS, c.mood)}, energy ${labelOf(ENERGIES, c.energy)}${c.note ? ` — ${c.note}` : ''}`}</title>
            {c.sleep_hours != null && (
              <rect x={x + 8} width={COL - 16} y={sy(c.sleep_hours)} height={H - sy(c.sleep_hours)} rx="6" fill="#439775" opacity={c.is_sample ? 0.55 : 0.9} />
            )}
            {/* mood row */}
            <circle cx={x + COL / 2} cy={H + 60 - MOOD_Y[c.mood] * 9} r="5" fill="#0A0A0A" />
            {flags.length > 0 && (
              <text x={x + COL / 2} y={H + 18} textAnchor="middle" fontSize="12" fill="#2F7557">{'•'.repeat(flags.length)}</text>
            )}
          </g>
        )
      })}
      <text x={PAD - 6} y={H + 60} textAnchor="end" fontSize="10" fill="#2B3A33">mood</text>
      <DayAxis days={days} y={H + 92} />
    </svg>
  )
}

function MeasuredChart({ days, byDay }) {
  // Two bands with their own scales so heart rate and breathing are never visually merged.
  const BAND = 70
  const rows = [
    { key: 'avg_heart_rate', label: 'bpm', y0: 0, lo: 45, hi: 110, color: '#6B6FD6' },
    { key: 'avg_breathing_rate', label: '/min', y0: BAND + 24, lo: 6, hi: 28, color: '#0A0A0A' },
  ]
  return (
    <svg viewBox={`0 0 ${W} ${BAND * 2 + 60}`} width="100%" role="img" aria-label="Camera heart rate and breathing by day">
      {rows.map((r) => (
        <g key={r.key}>
          <line x1={PAD} x2={W} y1={r.y0 + BAND} y2={r.y0 + BAND} stroke="#b9bbe8" />
          <text x={PAD - 6} y={r.y0 + BAND / 2 + 4} textAnchor="end" fontSize="10" fill="#333">{r.label}</text>
        </g>
      ))}
      {days.map((d, i) => {
        const m = byDay[d]
        const cx = colX(i) + COL / 2
        if (!m) return null
        if (m.good_readings === 0) {
          return <text key={d} x={cx} y={BAND} textAnchor="middle" fontSize="10" fill="#666">No reading</text>
        }
        return (
          <g key={d} opacity={m.is_sample ? 0.6 : 1}>
            <title>{`${shortDay(d)}: heart rate ${Math.round(m.avg_heart_rate)} bpm, breathing ${Math.round(m.avg_breathing_rate)}/min (${m.good_readings}/${m.total_readings} good readings)`}</title>
            {rows.map((r) => {
              const v = m[r.key]
              const y = r.y0 + BAND - ((Math.min(Math.max(v, r.lo), r.hi) - r.lo) / (r.hi - r.lo)) * (BAND - 18)
              return (
                <g key={r.key}>
                  <circle cx={cx} cy={y} r="6" fill={r.color} />
                  <text x={cx} y={y - 10} textAnchor="middle" fontSize="11" fontWeight="600" fill={r.color}>{Math.round(v)}</text>
                </g>
              )
            })}
          </g>
        )
      })}
      <DayAxis days={days} y={BAND * 2 + 50} />
    </svg>
  )
}

function Lane({ bg, kicker, title, legend, children }) {
  return (
    <section className="tile" style={{ background: bg, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <TileHead kicker={kicker} title={title} tilt={-1} align="start" />
        <div className="muted" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>{legend}</div>
      </div>
      {children}
    </section>
  )
}

export default function Timeline() {
  const [data, setData] = useState(null)
  const [summary, setSummary] = useState(null)
  const days = useMemo(() => lastNDays(DAYS), [])

  useEffect(() => {
    api.get(`/api/timeline?days=${DAYS}`).then(setData).catch(() => setData({ reported: [], measured: [] }))
    api.get('/api/summary').then(setSummary).catch(() => {})
  }, [])

  const reported = Object.fromEntries((data?.reported ?? []).map((c) => [c.day, c]))
  const measured = Object.fromEntries((data?.measured ?? []).map((m) => [m.day, m]))
  const notes = (data?.reported ?? []).filter((c) => c.note).reverse()
  const hasSample = (data?.reported ?? []).some((c) => c.is_sample)

  return (
    <>
      <header className="page-header">
        <h1>Timeline</h1>
        <p className="lede">What you reported and what the camera measured, in two separate lanes. They are never combined into a score.</p>
        <div className="meta">
          <span>Last {DAYS} days</span>
          {hasSample && <span className="sample-badge">Includes sample data</span>}
        </div>
      </header>

      {summary && (
        <section className="tile" style={{ background: 'var(--butter)', border: '1px solid var(--butter-line)', padding: 24 }}>
          <TileHead kicker="Your last 7 days" title="In plain words" tilt={-2} align="start" />
          <p style={{ margin: '16px 0 0', fontSize: 16, lineHeight: 1.5, maxWidth: 720 }}>{summary.text}</p>
          <p className="muted" style={{ margin: '8px 0 0' }}>
            {summary.source === 'gemini' ? 'Worded by Gemini from the numbers above. ' : ''}Based only on your own entries.
          </p>
        </section>
      )}

      <Lane bg="var(--mint)" kicker="Self-reported" title="What you reported"
        legend={<><span>▮ sleep hours</span><span>● mood</span><span style={{ color: '#2F7557' }}>• flags (racing thoughts, irritable…)</span></>}>
        <ReportedChart days={days} byDay={reported} />
      </Lane>

      <Lane bg="var(--lavender)" kicker="Camera sessions" title="What the camera measured"
        legend={<><span style={{ color: '#6B6FD6' }}>● heart rate (bpm)</span><span>● breathing (per min)</span></>}>
        {data?.measured?.length ? <MeasuredChart days={days} byDay={measured} /> : <p style={{ margin: 0 }}>No camera sessions in this period.</p>}
      </Lane>

      {notes.length > 0 && (
        <section className="tile" style={{ background: 'var(--page)', padding: 24 }}>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Your notes</h2>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            {notes.map((c) => <li key={c.day}><strong>{shortDay(c.day)}</strong> — {c.note}</li>)}
          </ul>
        </section>
      )}
    </>
  )
}
