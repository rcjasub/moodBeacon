import { useState } from 'react'

/**
 * Radar chart in plain SVG. `axes` = [{ key, label }], `series` = [{ name, values: {key: 0..1}, color, dashed }].
 * Values are fractions (0..1), drawn on a fixed 0-100% scale so shapes are comparable over time.
 * Hovering or focusing an axis shows every series' value for it.
 */
export default function RadarChart({ axes, series, size = 320 }) {
  const [hover, setHover] = useState(null)
  const c = size / 2
  const r = c - 56 // room for the axis labels
  const angle = (i) => -Math.PI / 2 + (i / axes.length) * 2 * Math.PI
  const at = (i, v) => [c + Math.cos(angle(i)) * r * v, c + Math.sin(angle(i)) * r * v]
  const ring = (v) => axes.map((_, i) => at(i, v).join(',')).join(' ')
  const pct = (v) => `${Math.round((v ?? 0) * 100)}%`
  const shown = series.filter((s) => s.values)

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" role="img"
        aria-label={`Radar chart: ${shown.map((s) => `${s.name}: ${axes.map((a) => `${a.label} ${pct(s.values[a.key])}`).join(', ')}`).join('. ')}`}>
        {[0.25, 0.5, 0.75, 1].map((v) => (
          <polygon key={v} points={ring(v)} fill="none" stroke="#e5e5e5" strokeWidth="1" />
        ))}
        {axes.map((a, i) => {
          const [x, y] = at(i, 1)
          return <line key={a.key} x1={c} y1={c} x2={x} y2={y} stroke={hover === i ? '#999' : '#e5e5e5'} strokeWidth="1" />
        })}
        {/* Scale labels sit between the first two axes so they never cover data or axis labels. */}
        {[0.5, 1].map((v) => {
          const a = angle(0) + Math.PI / axes.length
          return (
            <text key={v} x={c + Math.cos(a) * r * v * 0.92} y={c + Math.sin(a) * r * v * 0.92} fontSize="10" fill="var(--muted)"
              textAnchor="middle" dominantBaseline="middle">{v * 100}%</text>
          )
        })}

        {shown.map((s) => (
          <g key={s.name}>
            <polygon points={axes.map((a, i) => at(i, s.values[a.key] ?? 0).join(',')).join(' ')}
              fill={s.dashed ? 'none' : s.color} fillOpacity={s.dashed ? 0 : 0.18}
              stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeDasharray={s.dashed ? '5 4' : undefined}
              style={{ transition: 'all .4s ease' }} />
            {!s.dashed && axes.map((a, i) => {
              const [x, y] = at(i, s.values[a.key] ?? 0)
              return <circle key={a.key} cx={x} cy={y} r={hover === i ? 5 : 3.5} fill={s.color} stroke="#fff" strokeWidth="2" />
            })}
          </g>
        ))}

        {axes.map((a, i) => {
          const [x, y] = at(i, 1.18)
          const cos = Math.cos(angle(i))
          return (
            <text key={a.key} x={x} y={y} dominantBaseline="middle" fontSize="13" fontWeight={hover === i ? 700 : 600} fill="var(--ink)"
              textAnchor={Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end'}>
              {a.label}
            </text>
          )
        })}

        {/* Hit targets: a wedge per axis, much bigger than the marks. */}
        {axes.map((a, i) => {
          const half = Math.PI / axes.length
          const p = (t) => `${c + Math.cos(angle(i) + t) * (r + 40)},${c + Math.sin(angle(i) + t) * (r + 40)}`
          return (
            <polygon key={a.key} points={`${c},${c} ${p(-half)} ${p(half)}`} fill="transparent" tabIndex={0}
              aria-label={`${a.label}: ${shown.map((s) => `${s.name} ${pct(s.values[a.key])}`).join(', ')}`}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)} onBlur={() => setHover(null)} style={{ outline: 'none' }} />
          )
        })}
      </svg>

      {hover != null && shown.length > 0 && (() => {
        const [x, y] = at(hover, 0.55)
        return (
          <div role="tooltip" style={{
            position: 'absolute', left: `${(x / size) * 100}%`, top: `${(y / size) * 100}%`, transform: 'translate(-50%, -50%)',
            pointerEvents: 'none', background: 'var(--ink)', color: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 13, whiteSpace: 'nowrap',
          }}>
            <strong style={{ display: 'block', marginBottom: 2 }}>{axes[hover].label}</strong>
            {shown.map((s) => (
              <span key={s.name} style={{ display: 'block' }}>{s.name}: {pct(s.values[axes[hover].key])}</span>
            ))}
          </div>
        )
      })()}
    </div>
  )
}
