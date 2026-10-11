import { useEffect, useState } from 'react'
import PaperCrumple from '../components/PaperCrumple/PaperCrumple.jsx'
import TileHead from '../components/TileHead.jsx'
import HeartCheck from '../components/HeartCheck.jsx'
import { api } from '../lib/api.js'
import { PAPER_H, PAPER_W, notePaperURL } from '../lib/notePaper.js'

const TOSS_MS = 650
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const day = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export default function LetItGo() {
  const [notes, setNotes] = useState([])
  const [currentId, setCurrentId] = useState(null)
  const [text, setText] = useState('')
  const [msg, setMsg] = useState(null)
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    api.get('/api/notes').then(setNotes).catch(() => setMsg('Cannot reach the BipolarBird API.'))
  }, [])

  const current = notes.find((n) => n.id === currentId) ?? notes[0]
  const pile = notes.filter((n) => n !== current)

  const add = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    try {
      const note = await api.post('/api/notes', { text })
      setNotes((ns) => [note, ...ns])
      setCurrentId(note.id)
      setText('')
      setMsg(null)
    } catch (err) {
      setMsg(`Could not save: ${err.message}`)
    }
  }

  const release = async (note) => {
    await api.del(`/api/notes/${note.id}`)
    setNotes((ns) => ns.filter((n) => n.id !== note.id))
    setCurrentId(null)
    setMsg('Gone. It has been deleted for good.')
  }

  return (
    <>
      <header className="page-header">
        <h1>Let it go</h1>
        <p className="lede">Write down a thought you want to put down. When you are ready, crumple it up and throw it away.</p>
        <div className="meta"><span>Not part of your check-ins</span><span>Never sent anywhere</span></div>
      </header>

      <div className="row">
        <form className="tile" onSubmit={add} style={{ flex: '1 1 320px', minWidth: 0, background: 'var(--pink)', padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TileHead kicker="Just for you" title="Write it down" tilt={-1} align="start" />
          <label htmlFor="release" className="label">What's on your mind?</label>
          <textarea id="release" className="textarea" rows={5} maxLength={600} value={text}
            onChange={(e) => setText(e.target.value)} placeholder="A worry, a frustration, something you keep replaying…" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <button type="submit" className="btn btn-dark" disabled={!text.trim()}>Put it on paper</button>
            <span className="muted">{text.length}/600</span>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            These notes stay out of your timeline, rules and summaries. Throwing one away deletes it from your database.
          </p>
        </form>

        <section className="tile" aria-label="Your paper" style={{ flex: '1 1 380px', minWidth: 0, background: 'var(--page)', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {current
            ? <Sheet key={current.id} note={current} onRelease={release} />
            : <p style={{ margin: '48px 0', textAlign: 'center' }}>{msg ?? 'Nothing on the pile. Write something down when you need to.'}</p>}

          {pile.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="label">{pile.length} more on the pile</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {pile.map((n) => (
                  <button key={n.id} type="button" className="chip" onClick={() => setCurrentId(n.id)}
                    style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {day(n.created_at)} · {n.text}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {asking
        ? <HeartCheck onClose={() => setAsking(false)} />
        : <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => setAsking(true)}>Answer the check-in questions</button>}
    </>
  )
}

function Sheet({ note, onRelease }) {
  const [src, setSrc] = useState(null)
  const [state, setState] = useState('flat')
  const [resetKey, setResetKey] = useState(0)
  const [tossing, setTossing] = useState(false)

  useEffect(() => {
    let live = true
    notePaperURL(note.text, day(note.created_at)).then((url) => live && setSrc(url))
    return () => { live = false }
  }, [note])

  const toss = () => {
    setTossing(true)
    setTimeout(() => onRelease(note).catch(() => setTossing(false)), reduceMotion() ? 0 : TOSS_MS)
  }

  const crumpled = state === 'crumpled'
  return (
    <>
      <p className="muted" style={{ margin: 0, textAlign: 'center' }} aria-live="polite">
        {crumpled ? 'Crumpled. Throw it away, or smooth it out if you are not ready.' : 'Press and hold the paper to crumple it.'}
      </p>
      <div style={{
        transition: `transform ${TOSS_MS}ms cubic-bezier(.5,-0.3,.8,.6), opacity ${TOSS_MS}ms ease-in`,
        transform: tossing ? 'translate(40%, 120%) rotate(35deg) scale(.4)' : 'none',
        opacity: tossing ? 0 : 1,
      }}>
        {src && (
          <PaperCrumple
            src={src}
            alt={`Note from ${day(note.created_at)}: ${note.text}`}
            width={PAPER_W}
            height={PAPER_H}
            sceneHeight={460}
            releaseBehavior="stay"
            crumpleAmount={1}
            crumpleDuration={0.9}
            paperColor="#FFFCE5"
            seed={note.id}
            resetKey={resetKey}
            disabled={tossing}
            onStateChange={setState}
          />
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {crumpled ? (
          <>
            <button type="button" className="btn btn-dark" onClick={toss} disabled={tossing}>Throw it away</button>
            <button type="button" className="btn" onClick={() => setResetKey((k) => k + 1)} disabled={tossing}>Smooth it out</button>
          </>
        ) : (
          <button type="button" className="btn btn-quiet" onClick={toss} disabled={tossing}>Throw away without crumpling</button>
        )}
      </div>
    </>
  )
}
