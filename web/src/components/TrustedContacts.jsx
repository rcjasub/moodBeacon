import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import TileHead from './TileHead.jsx'

export const RELATIONS = [['family', 'Family'], ['friend', 'Friend'], ['clinician', 'Psychiatrist or clinician']]
export const relationLabel = (id) => RELATIONS.find(([k]) => k === id)?.[1] ?? id

// People you choose to keep in the loop. Nothing is sent to them unless you tap to share.
export default function TrustedContacts() {
  const [contacts, setContacts] = useState([])
  const [form, setForm] = useState({ name: '', email: '', relation: 'family' })
  const [error, setError] = useState(null)

  const load = () => api.get('/api/contacts').then(setContacts).catch(() => {})
  useEffect(() => { load() }, [])

  const add = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await api.post('/api/contacts', form)
      setForm({ name: '', email: '', relation: form.relation })
      load()
    } catch (err) {
      setError(err.message.includes('pattern') || err.message.includes('email') ? 'Check the email address.' : `Could not add: ${err.message}`)
    }
  }

  const remove = async (id) => { await api.del(`/api/contacts/${id}`); load() }

  return (
    <section id="people" className="tile no-print" style={{ background: 'var(--butter)', padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <TileHead kicker="With your consent" title="People to notify" tilt={2} align="start" />
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, maxWidth: 640 }}>
        Family, friends or your psychiatrist. When the app notices something worth a look, you can let them know in one tap.
        Nothing is ever sent unless you choose to send it.
      </p>

      {contacts.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {contacts.map((c) => (
            <li key={c.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#fff', border: '2px solid var(--ink)' }}>
              <strong>{c.name}</strong>
              <span className="muted">{c.email}</span>
              <span className="sample-badge">{relationLabel(c.relation)}</span>
              <button type="button" className="btn btn-quiet" style={{ marginLeft: 'auto' }} onClick={() => remove(c.id)} aria-label={`Remove ${c.name}`}>Remove</button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 180px' }}>
          <label htmlFor="pc-name" className="label">Name</label>
          <input id="pc-name" className="input" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 220px' }}>
          <label htmlFor="pc-email" className="label">Email</label>
          <input id="pc-email" className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="pc-rel" className="label">Who they are</label>
          <select id="pc-rel" className="input" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })}>
            {RELATIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-dark">Add</button>
      </form>
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
    </section>
  )
}
