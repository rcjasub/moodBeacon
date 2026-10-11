import { useEffect, useState } from 'react'
import AppointmentPrep from '../components/AppointmentPrep.jsx'
import TrustedContacts from '../components/TrustedContacts.jsx'
import TileHead from '../components/TileHead.jsx'
import { api } from '../lib/api.js'

const EMPTY = { early_signs: '', what_helps: '', clinician_name: '', clinician_contact: '' }

export default function Plan() {
  const [plan, setPlan] = useState(EMPTY)
  const [status, setStatus] = useState(null)
  const set = (k) => (e) => setPlan((p) => ({ ...p, [k]: e.target.value }))

  useEffect(() => {
    api.get('/api/plan').then((p) => setPlan({ ...EMPTY, ...p })).catch(() => {})
  }, [])

  const save = async (e) => {
    e.preventDefault()
    try {
      const { early_signs, what_helps, clinician_name, clinician_contact } = plan
      await api.put('/api/plan', { early_signs, what_helps, clinician_name, clinician_contact })
      setStatus('Saved.')
    } catch (err) {
      setStatus(`Could not save: ${err.message}`)
    }
  }

  return (
    <>
      <header className="page-header no-print">
        <h1>Wellness plan</h1>
        <p className="lede">Written with your care team. Shown whenever a follow-up prompt appears, so your own plan is one tap away.</p>
      </header>

      <form className="tile no-print" onSubmit={save} style={{ background: 'var(--page)', padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <TileHead kicker="In your own words" title="My plan" tilt={-1} align="start" />
        <Field id="signs" label="Early signs I watch for" value={plan.early_signs} onChange={set('early_signs')}
          hint="For example: sleeping less but not feeling tired, talking faster, spending more." />
        <Field id="helps" label="What helps me" value={plan.what_helps} onChange={set('what_helps')}
          hint="For example: a regular bedtime, calling a friend, cutting back on caffeine." />
        <div id="clinician" style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 240px' }}>
            <label htmlFor="cn" className="label">Clinician or trusted person</label>
            <input id="cn" className="input" value={plan.clinician_name} onChange={set('clinician_name')} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 240px' }}>
            <label htmlFor="cc" className="label">Phone or email</label>
            <input id="cc" className="input" value={plan.clinician_contact} onChange={set('clinician_contact')} />
          </div>
        </div>
        {plan.clinician_contact && (
          <a className="btn" style={{ alignSelf: 'flex-start' }}
            href={plan.clinician_contact.includes('@') ? `mailto:${plan.clinician_contact}` : `tel:${plan.clinician_contact}`}>
            Contact {plan.clinician_name || 'clinician'}
          </a>
        )}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button type="submit" className="btn btn-dark">Save plan</button>
          <span className="muted" role="status">{status}</span>
        </div>
      </form>

      <TrustedContacts />

      <AppointmentPrep />
    </>
  )
}

function Field({ id, label, hint, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label htmlFor={id} className="label">{label}</label>
      <textarea id={id} className="textarea" rows={3} value={value} onChange={onChange} placeholder={hint} />
    </div>
  )
}
