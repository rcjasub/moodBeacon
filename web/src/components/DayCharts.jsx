import { useState } from 'react'
import { MOODS, shortDay } from '../lib/format.js'
import { HIGH, REPORTED, MOOD_COLOR } from '../lib/palette.js'

// Small-multiple charts on one shared day axis. Each chart has its own single y-scale
// (never dual-axis) and a per-day hover tooltip.

const W = 720
const GUTTER = 64 // left room for axis labels
const RIGHT = 8
const INK = '#0A0A0A'
const MUTED = '#6B7280'
const GRID = 'rgba(10,10,10,.08)'

const geometry = (n) => {
  const col = (W - GUTTER - RIGHT) / n
  return { col, cx: (i) => GUTTER + i * col + col / 2 }
}

/** Frame: title row, the svg, hover columns and a tooltip. `tip(i)` returns tooltip lines or null. */
function Frame({ title, note, days, height, tip, children, axis = false }) {
  const [hover, setHover] = useState(null)
  const { col, cx } = geometry(days.length)
  const lines = hover != null ? tip(hover) : null
  const H = height + (axis ? 26 : 0)
  return (
    <figure className="daychart">
      <figcaption>
        <span className="daychart-title">{title}</span>
        {note && <span className="daychart-note">{note}</span>}
      </figcaption>
      <div className="daychart-plot" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title} style={{ display: 'block', overflow: 'visible' }}>
          {hover != null && <rect x={GUTTER + hover * col + 1} y={0} width={col - 2} height={height} rx="6" fill="rgba(10,10,10,.05)" />}
          {children({ cx, col, hover })}
          {axis && days.map((d, i) => (i % 2 === days.length % 2 || i === days.length - 1) && (
            <text key={d} x={cx(i)} y={height + 18} textAnchor="middle" fontSize="11" fill={MUTED}>{shortDay(d)}</text>
          ))}
          {days.map((d, i) => (
            <rect key={d} x={GUTTER + i * col} y={0} width={col} height={height} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>
        {lines && (
          <div className="daychart-tip" style={{ left: `${(cx(hover) / W) * 100}%` }}>
            <strong>{shortDay(days[hover])}</strong>
            {lines.map((l) => <span key={l}>{l}</span>)}
          </div>
        )}
      </div>
    </figure>
  )
}

function YGrid({ ticks, y, unit }) {
  return ticks.map((t) => (
    <g key={t}>
      <line x1={GUTTER} x2={W - RIGHT} y1={y(t)} y2={y(t)} stroke={GRID} />
      <text x={GUTTER - 10} y={y(t) + 4} textAnchor="end" fontSize="11" fill={MUTED}>{t}{unit}</text>
    </g>
  ))
}

export function SleepChart({ days, byDay }) {
  const H = 150
  const y = (h) => H - (Math.min(h, 12) / 12) * (H - 8)
  return (
    <Frame title="Sleep" note="hours a night" days={days} height={H}
      tip={(i) => { const c = byDay[days[i]]; return c ? [c.sleep_hours != null ? `${c.sleep_hours} h sleep` : 'Sleep not entered'] : ['No check-in'] }}>
      {({ cx, col, hover }) => (
        <>
          <YGrid ticks={[0, 4, 8, 12]} y={y} unit="h" />
          {days.map((d, i) => {
            const h = byDay[d]?.sleep_hours
            if (h == null) return <circle key={d} cx={cx(i)} cy={H} r="2" fill="#C9CDD3" />
            const w = Math.min(28, col - 10)
            const top = y(h)
            // Rounded at the top, square on the baseline.
            const r = Math.min(4, (H - top) / 2)
            const x0 = cx(i) - w / 2
            return (
              <path key={d} fill={REPORTED} opacity={byDay[d].is_sample ? 0.5 : hover === i ? 1 : 0.9}
                d={`M${x0},${H} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + w - r} Q${x0 + w},${top} ${x0 + w},${top + r} V${H} Z`} />
            )
          })}
        </>
      )}
    </Frame>
  )
}

export function MoodChart({ days, byDay }) {
  const ROW = 22
  const H = ROW * MOODS.length
  const y = (id) => H - (MOODS.findIndex((m) => m.id === id) + 0.5) * ROW
  const points = days.map((d, i) => byDay[d] && { i, c: byDay[d] }).filter(Boolean)
  return (
    <Frame title="Mood" note="as you reported it" days={days} height={H}
      tip={(i) => { const c = byDay[days[i]]; return [c ? MOODS.find((m) => m.id === c.mood).label : 'No check-in'] }}>
      {({ cx, hover }) => (
        <>
          {MOODS.map((m) => (
            <g key={m.id}>
              <line x1={GUTTER} x2={W - RIGHT} y1={y(m.id)} y2={y(m.id)} stroke={GRID} strokeDasharray={m.id === 'steady' ? undefined : '2 4'} />
              <text x={GUTTER - 10} y={y(m.id) + 4} textAnchor="end" fontSize="11" fill={MUTED}>{m.label}</text>
            </g>
          ))}
          {points.length > 1 && (
            <polyline fill="none" stroke="rgba(10,10,10,.25)" strokeWidth="2" strokeLinejoin="round"
              points={points.map(({ i, c }) => `${cx(i)},${y(c.mood)}`).join(' ')} />
          )}
          {points.map(({ i, c }) => (
            <circle key={i} cx={cx(i)} cy={y(c.mood)} r={hover === i ? 7 : 5.5} fill={MOOD_COLOR[c.mood]} stroke="#fff" strokeWidth="2" opacity={c.is_sample ? 0.6 : 1} />
          ))}
        </>
      )}
    </Frame>
  )
}

const FLAG_LABELS = {
  racing_thoughts: 'Racing thoughts', irritable: 'Irritable', unusual_activity: 'Unusual activity',
  less_sleep_need: 'Needed less sleep', off_baseline: 'Off usual baseline',
}

export function FlagsChart({ days, byDay }) {
  const H = 34
  const flagsOf = (c) => (c ? Object.keys(FLAG_LABELS).filter((k) => c[k]) : [])
  return (
    <Frame title="Things you noticed" note="flags ticked in the check-in" days={days} height={H} axis
      tip={(i) => { const c = byDay[days[i]]; const f = flagsOf(c); return !c ? ['No check-in'] : f.length ? f.map((k) => FLAG_LABELS[k]) : ['Nothing flagged'] }}>
      {({ cx }) => days.map((d, i) => {
        const n = flagsOf(byDay[d]).length
        if (!byDay[d]) return null
        return n ? (
          <g key={d}>
            <circle cx={cx(i)} cy={H / 2} r={11} fill="#FEE2E2" stroke={HIGH} strokeWidth="1.5" />
            <text x={cx(i)} y={H / 2 + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill={INK}>{n}</text>
          </g>
        ) : <circle key={d} cx={cx(i)} cy={H / 2} r="3" fill={REPORTED} opacity="0.5" />
      })}
    </Frame>
  )
}

/** Line chart for one camera measure, with its typical range shaded. */
export function MeasureChart({ title, note, unit, days, byDay, field, lo, hi, band, ticks, color, axis }) {
  const H = 130
  const y = (v) => H - 6 - ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * (H - 12)
  const pts = days.map((d, i) => {
    const m = byDay[d]
    return m && m.good_readings > 0 && m[field] != null ? { i, v: m[field], m } : null
  }).filter(Boolean)
  return (
    <Frame title={title} note={note} days={days} height={H} axis={axis}
      tip={(i) => {
        const m = byDay[days[i]]
        if (!m) return ['No session']
        if (!m.good_readings) return ['No reliable reading']
        return [`${Math.round(m[field])} ${unit}`, `${m.good_readings} of ${m.total_readings} readings usable`]
      }}>
      {({ cx, hover }) => (
        <>
          <rect x={GUTTER} width={W - GUTTER - RIGHT} y={y(band[1])} height={y(band[0]) - y(band[1])} fill={color} opacity="0.08" />
          <text x={GUTTER + 8} y={y(band[1]) + 14} fontSize="11" fill={MUTED}>typical resting {band[0]}–{band[1]}</text>
          <YGrid ticks={ticks} y={y} unit="" />
          {pts.length > 1 && (
            <polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
              points={pts.map((p) => `${cx(p.i)},${y(p.v)}`).join(' ')} />
          )}
          {pts.map((p, k) => (
            <g key={p.i}>
              <circle cx={cx(p.i)} cy={y(p.v)} r={hover === p.i ? 6.5 : 5} fill={color} stroke="#fff" strokeWidth="2" opacity={p.m.is_sample ? 0.6 : 1} />
              {k === pts.length - 1 && hover == null && (
                <text x={cx(p.i)} y={y(p.v) - 12} textAnchor="middle" fontSize="12" fontWeight="700" fill={INK}>{Math.round(p.v)}</text>
              )}
            </g>
          ))}
        </>
      )}
    </Frame>
  )
}
