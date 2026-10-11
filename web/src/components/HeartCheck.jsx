import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import TileHead from './TileHead.jsx'

// Follow-up after a session with a higher heart rate than usual: rule out everyday causes first,
// then (only if none apply) a short questionnaire about signs of a high phase, then share it.
export default function HeartCheck({ session, onClose }) {
  const [form, setForm] = useState(null)
  const [step, setStep] = useState('reasons') // reasons | explained | questions | result
  const [reasons, setReasons] = useState([])
  const [answers, setAnswers] = useState({})
  const [also, setAlso] = useState([])
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => { api.get('/api/screenings/form').then(setForm).catch((e) => setError(e.message)) }, [])

  const toggle = (list, setList, id) => setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  const save = async (withAnswers) => {
    setError(null)
    try {
      const row = await api.post('/api/screenings', {
        session_id: session.id,
        explained_by: reasons,
        answers: withAnswers ? answers : null,
        also_noticed: withAnswers ? also : [],
      })
      setResult(row)
      setStep(withAnswers ? 'result' : 'explained')
    } catch (e) {
      setError(e.message)
    }
  }

  if (!form) return error ? <p className="error">{error}</p> : null
  const allAnswered = form.items.every((it) => answers[it.id] != null)

  return (
    <section className="tile" aria-labelledby="hc" style={{ background: 'var(--butter)', padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <TileHead id="hc" kicker="From this session" title="Higher heart rate" tilt={-2} align="start" />
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{session.heart_check.message}</p>

      {step === 'reasons' && (
        <>
          <fieldset style={{ display: 'flex', flexDirection: 'column' }}>
            <legend className="label" style={{ marginBottom: 8 }}>Lots of everyday things raise heart rate. Did any of these happen recently?</legend>
            {form.reasons.map((r) => (
              <label key={r.id} className="check">
                <input type="checkbox" checked={reasons.includes(r.id)} onChange={() => toggle(reasons, setReasons, r.id)} />
                {r.label}
              </label>
            ))}
          </fieldset>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="btn btn-dark" disabled={!reasons.length} onClick={() => save(false)}>That explains it</button>
            <button type="button" className="btn" onClick={() => { setReasons([]); setStep('questions') }}>None of these</button>
            <button type="button" className="btn btn-quiet" onClick={onClose}>Not now</button>
          </div>
        </>
      )}

      {step === 'explained' && (
        <>
          <p style={{ margin: 0, lineHeight: 1.5 }}>That's a common reason for a higher reading, so there's nothing more to do. If your heart rate stays high when you're resting, check with a doctor.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="btn btn-dark" onClick={onClose}>Done</button>
            <button type="button" className="btn" onClick={() => setStep('questions')}>Answer the questions anyway</button>
          </div>
        </>
      )}

      {step === 'questions' && (
        <>
          <p className="muted" style={{ margin: 0 }}>
            Five quick questions about <strong>the past week</strong>, adapted from the Altman Self-Rating Mania Scale.
            This is not a diagnosis. It helps you notice changes and talk them over.
          </p>
          {form.items.map((it) => (
            <fieldset key={it.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <legend className="label" style={{ marginBottom: 8 }}>{it.label}</legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {form.frequency.map((f, i) => (
                  <button key={f} type="button" className="chip" aria-pressed={answers[it.id] === i}
                    onClick={() => setAnswers((a) => ({ ...a, [it.id]: i }))}>{f}</button>
                ))}
              </div>
            </fieldset>
          ))}
          <fieldset style={{ display: 'flex', flexDirection: 'column' }}>
            <legend className="label" style={{ marginBottom: 8 }}>Anything else you noticed this week? (optional)</legend>
            {form.also.map((a) => (
              <label key={a.id} className="check">
                <input type="checkbox" checked={also.includes(a.id)} onChange={() => toggle(also, setAlso, a.id)} />
                {a.label}
              </label>
            ))}
          </fieldset>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="btn btn-dark" disabled={!allAnswered} onClick={() => save(true)}>See my answers</button>
            <button type="button" className="btn btn-quiet" onClick={onClose}>Not now</button>
          </div>
        </>
      )}

      {step === 'result' && result && (
        <>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, fontWeight: 600 }}>{result.outcome}</p>
          <Share result={result} emailEnabled={form.email_enabled} draftEnabled={form.draft_enabled} />
          <button type="button" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }} onClick={onClose}>Close</button>
        </>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  )
}

const RECIPIENTS = [['friend', 'A friend'], ['family', 'Family'], ['clinician', 'A professional']]

function Share({ result, emailEnabled, draftEnabled }) {
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState(null)
  const [recipient, setRecipient] = useState('friend')
  const [drafting, setDrafting] = useState(false)
  const [drafted, setDrafted] = useState(null) // 'gemini' | 'template'

  const draft = async () => {
    setDrafting(true)
    try {
      const res = await api.post(`/api/screenings/${result.id}/draft`, { recipient })
      setNote(res.note)
      setDrafted(res.source)
    } catch (e) {
      setStatus(`Could not draft a note: ${e.message}`)
    } finally {
      setDrafting(false)
    }
  }

  const [contacts, setContacts] = useState([])

  // Pre-fill with the clinician or trusted person from the wellness plan, if it's an email.
  useEffect(() => {
    api.get('/api/plan').then((p) => { if (p.clinician_contact?.includes('@')) setTo(p.clinician_contact) }).catch(() => {})
    api.get('/api/contacts').then(setContacts).catch(() => {})
  }, [])

  const pickContact = (c) => {
    setTo(c.email)
    setRecipient(c.relation === 'clinician' ? 'clinician' : c.relation)
  }

  const body = (note.trim() ? `${note.trim()}\n\n` : '') + result.text
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(result.subject)}&body=${encodeURIComponent(body)}`
  const validTo = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)

  const send = async () => {
    setStatus('Sending…')
    try {
      await api.post(`/api/screenings/${result.id}/email`, { to, note })
      setStatus(`Sent to ${to}.`)
    } catch (e) {
      setStatus(`Could not send: ${e.message}`)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 20, borderRadius: 12, background: '#fff' }}>
      <h3 style={{ fontSize: 18 }}>Share with someone you trust</h3>
      <p className="muted" style={{ margin: 0 }}>A friend, family member, or professional. Nothing is sent unless you choose to.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label htmlFor="share-to" className="label">Their email</label>
        <input id="share-to" className="input" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" />
        {contacts.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {contacts.map((c) => (
              <button key={c.id} type="button" className="chip" aria-pressed={to === c.email} onClick={() => pickContact(c)}>{c.name}</button>
            ))}
          </div>
        )}
      </div>
      <fieldset style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <legend className="label" style={{ marginBottom: 8 }}>Who is it for?</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {RECIPIENTS.map(([id, label]) => (
            <button key={id} type="button" className="chip" aria-pressed={recipient === id} onClick={() => setRecipient(id)}>{label}</button>
          ))}
          <button type="button" className="btn" onClick={draft} disabled={drafting}>
            {drafting ? 'Writing…' : draftEnabled ? 'Draft a note with Gemini' : 'Suggest a note'}
          </button>
        </div>
      </fieldset>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label htmlFor="share-note" className="label">A note from you (optional)</label>
        <textarea id="share-note" className="textarea" rows={4} value={note} onChange={(e) => { setNote(e.target.value); setDrafted(null) }}
          placeholder="Hi, I'd like to talk about how I've been feeling this week." />
        {drafted && (
          <span className="muted">
            {drafted === 'gemini' ? 'Drafted by Gemini from your results (no names or notes were sent).' : 'A suggested note.'} Edit it however you like.
          </span>
        )}
      </div>
      <details>
        <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Preview what they'll see</summary>
        <pre style={{ whiteSpace: 'pre-wrap', font: '400 14px/1.5 var(--body)', margin: '12px 0 0' }}>{body}</pre>
      </details>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {emailEnabled && <button type="button" className="btn btn-dark" disabled={!validTo} onClick={send}>Send email</button>}
        <a className={emailEnabled ? 'btn' : 'btn btn-dark'} href={validTo ? mailto : undefined} aria-disabled={!validTo}
          style={validTo ? undefined : { opacity: 0.5, pointerEvents: 'none' }}>Open in my email app</a>
        <span className="muted" role="status">{status}</span>
      </div>
    </div>
  )
}
