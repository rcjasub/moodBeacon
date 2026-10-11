import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { HIGH, MEASURED } from '../../lib/palette.js'
import './BentoDashboard.css'

// Brutalist bento of three charts: bars, radar and donut. Ported from a Tailwind/shadcn
// component to plain CSS so it fits this app. Data comes in through props.

const spring = { type: 'spring', stiffness: 300, damping: 20 }

/** bars: [{ label, value (0-100, bar height), display, color }]; value null = no entry. */
export function BarChart({ title, bars }) {
  const [hovered, setHovered] = useState(null)
  return (
    <div className="bento-card">
      <h3 className="bento-title">{title}</h3>
      <div className="bento-bars">
        {bars.map((b, i) => (
          <div key={b.label + i} className="bento-bar-slot">
            {b.value == null ? (
              <span className="bento-bar-empty">{b.label}<br />—</span>
            ) : (
              <motion.div
                className="bento-bar"
                style={{ background: b.color }}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(b.value, 8)}%` }}
                transition={{ type: 'spring', stiffness: 200, damping: 20, delay: i * 0.08 }}
                onHoverStart={() => setHovered(i)}
                onHoverEnd={() => setHovered(null)}
                whileHover={{ scaleY: 1.06, scaleX: 1.05 }}
                whileTap={{ scaleY: 0.95 }}
              >
                <div className="bento-dots" />
                <span className="bento-bar-label">{b.label}</span>
              </motion.div>
            )}
            <AnimatePresence>
              {hovered === i && (
                <motion.div className="bento-tip" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
                  {b.display}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  )
}

const SIZE = 200
const CENTER = SIZE / 2
const RADIUS = 80

/** axes: [{ label, value (0-100), display, color }] */
export function RadarChart({ title, watermark, axes }) {
  const [hovered, setHovered] = useState(null)
  const coords = (value, i) => {
    const a = (Math.PI / 180) * ((360 / axes.length) * i - 90)
    const r = (value / 100) * RADIUS
    return { x: CENTER + r * Math.cos(a), y: CENTER + r * Math.sin(a) }
  }
  const polygon = (fn) => axes.map((d, i) => {
    const c = coords(fn(d), i)
    return `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`
  }).join(' ') + ' Z'

  return (
    <div className="bento-card bento-radar">
      <div className="bento-radar-chart">
        {watermark && <span className="bento-watermark">{watermark}</span>}
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="bento-radar-svg" role="img" aria-label={title}>
          {[100, 75, 50, 25].map((lvl) => (
            <path key={lvl} d={polygon(() => lvl)} fill="none" stroke="rgba(0,0,0,.1)" strokeWidth="2" strokeDasharray="4 4" />
          ))}
          {axes.map((_, i) => {
            const o = coords(100, i)
            return <line key={i} x1={CENTER} y1={CENTER} x2={o.x} y2={o.y} stroke="rgba(0,0,0,.1)" strokeWidth="2" />
          })}
          <motion.path
            d={polygon((d) => d.value)}
            fill={MEASURED} fillOpacity="0.3" stroke="#000" strokeWidth="4" strokeLinejoin="round"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
            style={{ originX: '50%', originY: '50%' }}
          />
          {axes.map((d, i) => {
            const c = coords(d.value, i)
            const on = hovered === d.label
            return (
              <g key={d.label} onMouseEnter={() => setHovered(d.label)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
                <circle cx={c.x} cy={c.y} r="20" fill="transparent" />
                <motion.circle cx={c.x} cy={c.y} r="6" stroke="#000"
                  initial={false}
                  animate={{ scale: on ? 2 : 1, strokeWidth: on ? 4 : 3, fill: on ? HIGH : '#fff' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }} />
              </g>
            )
          })}
        </svg>
      </div>
      <div className="bento-radar-list">
        <h3 className="bento-title" style={{ marginBottom: 8 }}>{title}</h3>
        {axes.map((d) => (
          <motion.div key={d.label} className="bento-row"
            onMouseEnter={() => setHovered(d.label)} onMouseLeave={() => setHovered(null)}
            animate={{ x: hovered === d.label ? 10 : 0 }}>
            <span className="bento-row-name"><span className="bento-swatch" style={{ background: d.color }} />{d.label}</span>
            <strong>{d.display}</strong>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/** slices: [{ label, value (count), color }]. Shows each slice's share of the total. */
export function DonutChart({ title, slices, totalLabel }) {
  const [hovered, setHovered] = useState(null)
  const total = slices.reduce((s, x) => s + x.value, 0)
  const pct = (v) => Math.round((v / total) * 100)
  const point = (p) => [Math.cos(2 * Math.PI * p), Math.sin(2 * Math.PI * p)]
  let cumulative = 0
  const shown = slices.filter((s) => s.value > 0)
  const active = shown.find((s) => s.label === hovered)

  return (
    <div className="bento-card bento-donut">
      <div className="bento-dots bento-dots-lg" />
      <h3 className="bento-title bento-donut-title">{title}</h3>
      {total === 0 ? <p className="bento-empty">No check-ins yet.</p> : (
        <div className="bento-donut-body">
          <div className="bento-donut-ring">
            <motion.svg viewBox="-1.2 -1.2 2.4 2.4" className="bento-donut-svg" role="img" aria-label={title}
              initial={{ rotate: -180, scale: 0 }} animate={{ rotate: -90, scale: 1 }}
              transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.2 }}>
              {shown.map((s) => {
                const start = cumulative
                const end = cumulative + s.value / total
                cumulative = end
                const [sx, sy] = point(start)
                const [ex, ey] = point(end)
                // A single slice covering everything can't be drawn as an arc; use a full circle.
                const d = shown.length === 1
                  ? 'M 1 0 A 1 1 0 1 1 -1 0 A 1 1 0 1 1 1 0 Z'
                  : `M ${sx} ${sy} A 1 1 0 ${end - start > 0.5 ? 1 : 0} 1 ${ex} ${ey} L 0 0`
                const on = hovered === s.label
                const dim = hovered !== null && !on
                return (
                  <motion.path key={s.label} d={d} fill={s.color} stroke="#000" strokeWidth="0.04" strokeLinejoin="round"
                    animate={{
                      x: on && shown.length > 1 ? (sx + ex) * 0.1 : 0,
                      y: on && shown.length > 1 ? (sy + ey) * 0.1 : 0,
                      scale: on ? 1.05 : 1,
                      opacity: dim ? 0.3 : 1,
                      filter: dim ? 'grayscale(80%)' : 'grayscale(0%)',
                    }}
                    transition={spring}
                    onMouseEnter={() => setHovered(s.label)} onMouseLeave={() => setHovered(null)} />
                )
              })}
              <motion.circle cx="0" cy="0" r="0.55" fill="#fff" stroke="#000" strokeWidth="0.04"
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, ...spring }} />
            </motion.svg>
            <div className="bento-donut-center">
              <AnimatePresence mode="popLayout">
                <motion.div key={active?.label ?? 'total'} className="bento-donut-center-inner"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={spring}>
                  {active ? (
                    <>
                      <span className="bento-big">{pct(active.value)}%</span>
                      <span className="bento-tag">{active.label}</span>
                    </>
                  ) : (
                    <>
                      <span className="bento-big bento-big-lg">{total}</span>
                      <span className="bento-sub">{totalLabel}</span>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          <div className="bento-legend">
            {slices.map((s) => (
              <motion.div key={s.label} className="bento-row"
                onMouseEnter={() => s.value && setHovered(s.label)} onMouseLeave={() => setHovered(null)}
                animate={{ opacity: hovered && hovered !== s.label ? 0.3 : 1, scale: hovered === s.label ? 1.05 : 1 }}>
                <span className="bento-row-name"><span className="bento-swatch" style={{ background: s.color }} />{s.label}</span>
                <strong>{s.value}</strong>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Layout: bars and radar stacked on the left, donut full height on the right. */
export default function BentoDashboard({ heading, subheading, left, right }) {
  return (
    <section className="bento">
      <header className="bento-header">
        <h2>{heading}</h2>
        {subheading && <p>{subheading}</p>}
      </header>
      <div className="bento-grid">
        <div className="bento-col">{left}</div>
        <div className="bento-col">{right}</div>
      </div>
    </section>
  )
}
