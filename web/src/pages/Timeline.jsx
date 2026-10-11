import { useEffect, useMemo, useState } from 'react'
import TileHead from '../components/TileHead.jsx'
import { FlagsChart, MeasureChart, MoodChart, SleepChart } from '../components/DayCharts.jsx'
import { MEASURED, MEASURED_2, MOOD_COLOR, REPORTED } from '../lib/palette.js'
import BentoDashboard, { BarChart, DonutChart, RadarChart } from '../components/BentoDashboard/BentoDashboard.jsx'
import { api } from '../lib/api.js'
import { MOODS, shortDay, todayISO } from '../lib/format.js'

const DAYS = 14

function lastNDays(n) {
  const today = new Date(todayISO() + 'T00:00:00')
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (n - 1 - i))
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  })
}

const FLAG_AXES = [
  ['racing_thoughts', 'Racing'],
  ['irritable', 'Irritable'],
  ['less_sleep_need', 'Less sleep'],
  ['unusual_activity', 'Unusual'],
  ['off_baseline', 'Off usual'],
]

// Self-reported check-ins only, so it sits with the "reported" lane and never mixes in camera data.
function CheckinBento({ days, byDay }) {
  const week = days.slice(-7)
  const checkins = days.map((d) => byDay[d]).filter(Boolean)
  const bars = week.map((d) => {
    const h = byDay[d]?.sleep_hours
    return {
      label: new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
      value: h == null ? null : Math.min(100, (h / 12) * 100),
      display: h == null ? '' : `${h}h · ${shortDay(d)}`,
      color: REPORTED,
    }
  })
  const axes = FLAG_AXES.map(([key, label]) => {
    const n = checkins.filter((c) => c[key]).length
    return { label, color: MEASURED, value: checkins.length ? (n / checkins.length) * 100 : 0, display: `${n}/${checkins.length}` }
  })
  const slices = MOODS.map((m) => ({ label: m.label, color: MOOD_COLOR[m.id], value: checkins.filter((c) => c.mood === m.id).length }))
  return (
    <BentoDashboard
      heading="At a glance"
      subheading={`From your own check-ins · last ${DAYS} days`}
      left={<>
        <BarChart title="Sleep this week" bars={bars} />
        <RadarChart title="What you noticed" watermark="Days" axes={axes} />
      </>}
      right={<DonutChart title="Mood mix" slices={slices} totalLabel="check-ins" />}
    />
  )
}

function Lane({ bg, kicker, title, legend, children }) {
  return (
    <section className="panel" style={{ background: bg, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
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
        <section className="tile" style={{ background: 'var(--butter)', padding: 24 }}>
          <TileHead kicker="Your last 7 days" title="In plain words" tilt={-2} align="start" />
          <p style={{ margin: '16px 0 0', fontSize: 16, lineHeight: 1.5, maxWidth: 720 }}>{summary.text}</p>
          <p className="muted" style={{ margin: '8px 0 0' }}>
            {summary.source === 'gemini' ? 'Worded by Gemini from the numbers above. ' : ''}Based only on your own entries.
          </p>
        </section>
      )}

      {data && <CheckinBento days={days} byDay={reported} />}

      <Lane bg="var(--mint)" kicker="Self-reported" title="What you reported"
        legend={<span>Hover a day for details</span>}>
        <div className="daychart-stack">
          <SleepChart days={days} byDay={reported} />
          <MoodChart days={days} byDay={reported} />
          <FlagsChart days={days} byDay={reported} />
        </div>
      </Lane>

      <Lane bg="var(--lavender)" kicker="Camera sessions" title="What the camera measured"
        legend={<span>Typical value per day · hover for details</span>}>
        {data?.measured?.length ? (
          <div className="daychart-stack">
            <MeasureChart title="Heart rate" note="beats per minute" unit="bpm" days={days} byDay={measured}
              field="avg_heart_rate" lo={45} hi={125} band={[60, 100]} ticks={[50, 70, 90, 110]} color={MEASURED} />
            <MeasureChart title="Breathing" note="breaths per minute" unit="/min" days={days} byDay={measured}
              field="avg_breathing_rate" lo={6} hi={28} band={[12, 20]} ticks={[10, 15, 20, 25]} color={MEASURED_2} axis />
          </div>
        ) : <p style={{ margin: 0 }}>No camera sessions in this period.</p>}
      </Lane>
    </>
  )
}
