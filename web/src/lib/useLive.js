import { useEffect, useRef, useState } from 'react'
import { api, liveSocketUrl } from './api.js'

const TRACE_KEEP = 400 // samples per waveform kept on screen

/** Subscribes to /ws/live: sidecar status, session state, live readings, preview frames and tips. */
export function useLive() {
  const [sidecar, setSidecar] = useState(false)
  const [active, setActive] = useState(null)
  const [readings, setReadings] = useState([])
  const [lastSession, setLastSession] = useState(null)
  const [frame, setFrame] = useState(null) // base64 JPEG, kept in memory only
  const [hint, setHint] = useState('')
  const [traces, setTraces] = useState({ pulse: [], breathing: [] })
  const [startedAt, setStartedAt] = useState(null)
  const wsRef = useRef(null)

  useEffect(() => {
    let closed = false
    let retry
    const connect = () => {
      const ws = new WebSocket(liveSocketUrl())
      wsRef.current = ws
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data)
        if (m.type === 'status') {
          setSidecar(m.sidecar_connected)
          if ('active_session' in m) {
            setActive(m.active_session)
            // Joined mid-session (e.g. page reload): fetch when it started for the timer.
            if (m.active_session) {
              api.get(`/api/sessions/${m.active_session}`).then((s) => setStartedAt(new Date(s.started_at).getTime())).catch(() => {})
            }
          }
        } else if (m.type === 'session') {
          if (m.state === 'started') {
            setActive(m.session.id); setReadings([]); setLastSession(null); setStartedAt(Date.now())
          } else {
            setActive(null); setLastSession(m.session); setStartedAt(null)
          }
          setFrame(null)
          setHint('')
          setTraces({ pulse: [], breathing: [] })
        } else if (m.type === 'frame') {
          setFrame(m.jpeg)
        } else if (m.type === 'trace') {
          setTraces((t) => ({
            pulse: [...t.pulse, ...m.pulse].slice(-TRACE_KEEP),
            breathing: [...t.breathing, ...m.breathing].slice(-TRACE_KEEP),
          }))
        } else if (m.type === 'hint') {
          setHint(m.text)
        } else if (m.type === 'reading') {
          setReadings((r) => [...r.slice(-119), m])
        }
      }
      ws.onclose = () => {
        setSidecar(false)
        if (!closed) retry = setTimeout(connect, 2000)
      }
    }
    connect()
    return () => { closed = true; clearTimeout(retry); wsRef.current?.close() }
  }, [])

  return { sidecar, active, readings, lastSession, frame, hint, traces, startedAt }
}
