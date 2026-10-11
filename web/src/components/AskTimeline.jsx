import { useState } from 'react'
import { api } from '../lib/api.js'
import TileHead from './TileHead.jsx'

const EXAMPLES = [
  'How did my sleep this week compare to last week?',
  'Which days did I note racing thoughts?',
  'What was my heart rate on camera days?',
]

// Ask questions about your own last 30 days. The API builds the data; Gemini only words the answer.
export default function AskTimeline() {
  const [question, setQuestion] = useState('')
  const [asked, setAsked] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  const ask = async (q) => {
    const text = (q ?? question).trim()
    if (text.length < 3 || busy) return
    setQuestion(text)
    setAsked(text)
    setResult(null)
    setBusy(true)
    try {
      setResult(await api.post('/api/ask', { question: text }))
    } catch (e) {
      setResult({ answer: `Could not ask: ${e.message}`, source: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="tile" aria-labelledby="ask" style={{ background: 'var(--lavender)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TileHead id="ask" kicker="Your last 30 days" title="Ask your timeline" tilt={-2} align="start" />
      <form onSubmit={(e) => { e.preventDefault(); ask() }} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <label htmlFor="ask-q" className="sr-only">Your question</label>
        <input id="ask-q" className="input" style={{ flex: '1 1 280px', minWidth: 0 }} maxLength={300}
          placeholder="Ask about your sleep, mood, flags or camera readings…" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <button type="submit" className="btn btn-dark" disabled={busy || question.trim().length < 3}>{busy ? 'Thinking…' : 'Ask'}</button>
      </form>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {EXAMPLES.map((q) => <button key={q} type="button" className="chip" onClick={() => ask(q)} disabled={busy}>{q}</button>)}
      </div>
      {asked && (
        <div aria-live="polite" style={{ background: '#fff', border: '2px solid var(--ink)', padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="muted" style={{ fontWeight: 600 }}>{asked}</span>
          {busy && <span className="muted">Looking at your data…</span>}
          {result?.source === 'unavailable' && (
            <span>Asking questions needs Gemini. Add a <code>GEMINI_API_KEY</code> to the API's <code>.env</code> to turn it on.</span>
          )}
          {result?.answer && <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: result.source === 'error' ? 'var(--danger)' : undefined }}>{result.answer}</p>}
          {result?.source === 'gemini' && (
            <span className="muted">Worded by Gemini from your own check-ins and camera numbers. Notes are never sent. Not medical advice.</span>
          )}
        </div>
      )}
    </section>
  )
}
