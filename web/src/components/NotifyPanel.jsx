import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { relationLabel } from './TrustedContacts.jsx'

// Let chosen contacts know about a follow-up. Nobody is pre-selected: the person picks each time.
export default function NotifyPanel({ prompt, onClose }) {
  const [contacts, setContacts] = useState(null)
  const [picked, setPicked] = useState([])
  const [note, setNote] = useState('')
  const [share, setShare] = useState(null)
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    api.get('/api/contacts').then(setContacts).catch(() => setContacts([]))
    api.get(`/api/prompts/${prompt.id}/share`).then(setShare).catch(() => {})
    api.get('/api/status').then((s) => setEmailEnabled(!!s.email_enabled)).catch(() => {})
  }, [prompt.id])

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const chosen = (contacts ?? []).filter((c) => picked.includes(c.id))
  const body = (note.trim() ? `${note.trim()}\n\n` : '') + (share?.text ?? '')
  const mailto = share && chosen.length
    ? `mailto:${chosen.map((c) => encodeURIComponent(c.email)).join(',')}?subject=${encodeURIComponent(share.subject)}&body=${encodeURIComponent(body)}`
    : undefined

  const send = async () => {
    setStatus('Sending…')
    try {
      const res = await api.post(`/api/prompts/${prompt.id}/notify`, { contact_ids: picked, note })
      setStatus(`Sent to ${res.sent} ${res.sent === 1 ? 'person' : 'people'}.`)
    } catch (e) {
      setStatus(`Could not send: ${e.message}`)
    }
  }

  if (contacts === null) return null
  return (
    <div style={{ width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: '#fff', border: '2px solid var(--ink)' }}>
      <strong style={{ fontSize: 16 }}>Let your people know</strong>
      {contacts.length === 0 ? (
        <p style={{ margin: 0 }}>No one added yet. <Link to="/plan#people">Add family, friends or your psychiatrist</Link> on your wellness plan.</p>
      ) : (
        <>
          <fieldset style={{ display: 'flex', flexDirection: 'column' }}>
            <legend className="muted" style={{ marginBottom: 4 }}>Choose who gets this message:</legend>
            {contacts.map((c) => (
              <label key={c.id} className="check">
                <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} />
                {c.name} <span className="muted">· {relationLabel(c.relation)}</span>
              </label>
            ))}
          </fieldset>
          <textarea className="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} aria-label="A note from you (optional)"
            placeholder="A note from you (optional), e.g. Could you give me a call this week?" />
          {share && (
            <details>
              <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Preview the message</summary>
              <pre style={{ whiteSpace: 'pre-wrap', font: '400 14px/1.5 var(--body)', margin: '8px 0 0' }}>{body}</pre>
            </details>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {emailEnabled && <button type="button" className="btn btn-dark" disabled={!chosen.length} onClick={send}>Send now</button>}
            <a className={emailEnabled ? 'btn' : 'btn btn-dark'} href={mailto} aria-disabled={!mailto}
              style={mailto ? undefined : { opacity: 0.5, pointerEvents: 'none' }}>Open in my email app</a>
            <span className="muted" role="status">{status}</span>
          </div>
        </>
      )}
      <button type="button" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }} onClick={onClose}>Close</button>
    </div>
  )
}
