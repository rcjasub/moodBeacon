import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { ENERGIES, MOODS, todayISO } from '../lib/format.js'
import TileHead from './TileHead.jsx'

const EMPTY = {
  mood: null, energy: null, sleep_hours: '', less_sleep_need: false,
  irritable: false, racing_thoughts: false, unusual_activity: false, off_baseline: false,
}

const FLAGS = [
  ['irritable', 'Irritable or on edge'],
  ['racing_thoughts', 'Racing thoughts'],
  ['unusual_activity', 'Doing things unusual for me'],
  ['off_baseline', 'Different from my usual baseline'],
]

function ChipGroup({ legend, options, value, onPick }) {
  return (
    <fieldset style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <legend>{legend}</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => (
          <button key={o.id} type="button" className="chip" aria-pressed={value === o.id} onClick={() => onPick(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export default function CheckinForm({ onSaved }) {
  const [form, setForm] = useState(EMPTY)
  const [status, setStatus] = useState(null)
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))

  // Pre-fill if today's check-in already exists.
  useEffect(() => {
    api.get('/api/checkins/latest').then((c) => {
      if (c && c.day === todayISO()) {
        setForm({ ...EMPTY, ...c, sleep_hours: c.sleep_hours ?? '' })
        setStatus('Already saved today. Saving again replaces it.')
      }
    }).catch(() => {})
  }, [])

  const save = async (e) => {
    e.preventDefault()
    if (!form.mood || !form.energy) {
      setStatus('Pick a mood and an energy level first.')
      return
    }
    try {
      const body = { ...form, day: todayISO(), sleep_hours: form.sleep_hours === '' ? null : Number(form.sleep_hours) }
      for (const k of ['id', 'created_at', 'is_sample', 'note']) delete body[k]
      const res = await api.put('/api/checkins', body)
      setStatus('Saved.')
      onSaved?.(res)
    } catch (err) {
      setStatus(`Could not save: ${err.message}`)
    }
  }

  return (
    <form className="tile" onSubmit={save} style={{ flex: '2 1 520px', minWidth: 0, background: 'var(--mint)', padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <TileHead kicker="About a minute" title="Daily check-in" tilt={-1} align="start" />

      <ChipGroup legend="Mood" options={MOODS} value={form.mood} onPick={set('mood')} />
      <ChipGroup legend="Energy and activity" options={ENERGIES} value={form.energy} onPick={set('energy')} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor="sleep" className="label">Hours slept last night</label>
          <input id="sleep" className="input" type="number" min="0" max="16" step="0.5" style={{ width: 110 }}
            value={form.sleep_hours} onChange={(e) => set('sleep_hours')(e.target.value)} />
        </div>
        <label className="check">
          <input type="checkbox" checked={form.less_sleep_need} onChange={(e) => set('less_sleep_need')(e.target.checked)} />
          Needed less sleep than usual
        </label>
      </div>

      <fieldset style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(260px,100%),1fr))', columnGap: 24 }}>
        <legend style={{ marginBottom: 8 }}>Anything else today?</legend>
        {FLAGS.map(([k, label]) => (
          <label key={k} className="check">
            <input type="checkbox" checked={form[k]} onChange={(e) => set(k)(e.target.checked)} />
            {label}
          </label>
        ))}
      </fieldset>

      <p className="muted" style={{ margin: 0 }}>
        Something on your mind? <Link to="/let-it-go">Write it down and let it go</Link>.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <button type="submit" className="btn btn-dark">Save check-in</button>
        <span className="muted" role="status">{status || 'Saved on this computer only'}</span>
      </div>
    </form>
  )
}
