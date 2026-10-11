// Runs the Presage SmartSpectra SDK on the default webcam and prints JSON lines:
//   {"type":"reading","heart_rate":71.2,"breathing_rate":14.1,"quality":0.83,"reliable":true}   1/s, filtered + smoothed
//   {"type":"frame","jpeg":"<base64>"}   small live preview, ~8 fps, shown only to you
//   {"type":"hint","text":"Increase light on face."}   SDK positioning tips, when they change
//   {"type":"trace","pulse":[...],"breathing":[...]}   raw waveform samples, ~4x per second (display only)
// Started/stopped by run_sidecar.py. Frames stay in memory; nothing is written to disk.
// The API key comes from the PRESAGE_API_KEY env var (loaded from the repo-root .env).
import {
  SmartSpectraSDK, CameraSelection, PixelFormat, breathingMetrics, cardioMetrics, decodeMetrics,
} from '@smartspectra/node-sdk'
import jpeg from 'jpeg-js'

const apiKey = process.env.PRESAGE_API_KEY
if (!apiKey) {
  console.error('PRESAGE_API_KEY is not set')
  process.exit(1)
}

const sdk = new SmartSpectraSDK({
  apiKey,
  requestedMetrics: [...breathingMetrics, ...cardioMetrics],
})

// MeasurementWithConfidence: { value, confidence, stable, timestamp }.
// Confidence comes on a 0-100 scale; the API expects 0-1. Returns null when the SDK omits it,
// so a missing confidence doesn't count as zero quality.
function score(m) {
  if (typeof m.confidence !== 'number') return null
  const raw = m.confidence
  return Math.max(0, Math.min(1, raw > 1 ? raw / 100 : raw))
}

const median = (xs) => {
  const a = [...xs].sort((x, y) => x - y)
  const mid = a.length >> 1
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2
}

// Consistency filter for one signal. Only keeps values the SDK marks stable (protobuf omits
// false, so a missing flag means NOT stable), or, when minConfidence is set, unstable values
// whose confidence reaches it. Values must also be in a plausible range and not a sudden spike
// away from the recent median. Reports the median over a window that matches Presage's own
// averaging (12 s pulse, 30 s breathing), so the number on screen doesn't jump around.
function makeTracker({ min, max, windowMs, staleMs = 10000, spike = 0.2, minConfidence = null }) {
  let vals = [] // { v, q, at }
  const prune = (now) => { vals = vals.filter((x) => now - x.at <= windowMs) }
  return {
    add(m, now) {
      prune(now)
      const v = m.value
      const q = score(m)
      const confident = minConfidence != null && q != null && q >= minConfidence
      if ((m.stable !== true && !confident) || !(v >= min && v <= max)) return
      if (vals.length >= 3) {
        const med = median(vals.map((x) => x.v))
        if (Math.abs(v - med) / med > spike) return // one-off jump: ignore it
      }
      vals.push({ v, q, at: now })
    },
    current(now) {
      prune(now)
      if (!vals.length || now - vals.at(-1).at > staleMs) return null // face lost / poor light
      const qs = vals.map((x) => x.q).filter((q) => q != null)
      return { value: Math.round(median(vals.map((x) => x.v)) * 10) / 10, q: qs.length ? median(qs) : null }
    },
  }
}

const hrTrack = makeTracker({ min: 40, max: 180, windowMs: 12000 })
// Breathing is rarely marked stable, so also accept values with at least 50% confidence.
const brTrack = makeTracker({ min: 4, max: 40, windowMs: 30000, minConfidence: 0.5 })

// Fallback breathing rate counted from the raw breathing waveform, used while the SDK's own
// rate is still unsettled. Counts breaths as upward crossings of the window mean, with a
// hysteresis band so small wobbles don't count, then divides by the time they span.
const BREATH_WINDOW_MS = 30000
const BREATH_MIN_SPAN_MS = 15000
let breathSamples = [] // { t (ms), v }
let lastBreathSampleAt = 0
function addBreathSample(t, now) {
  lastBreathSampleAt = now
  const ts = t.timestamp != null ? Number(t.timestamp) / 1000 : now // SDK timestamps are in µs
  breathSamples.push({ t: ts, v: t.value })
  breathSamples = breathSamples.filter((x) => ts - x.t <= BREATH_WINDOW_MS)
}
function waveformBreathingRate(now) {
  if (now - lastBreathSampleAt > 10000) return null // face lost / poor light
  const s = breathSamples
  if (s.length < 20 || s.at(-1).t - s[0].t < BREATH_MIN_SPAN_MS) return null
  const mean = s.reduce((a, x) => a + x.v, 0) / s.length
  const sd = Math.sqrt(s.reduce((a, x) => a + (x.v - mean) ** 2, 0) / s.length)
  if (!(sd > 0)) return null
  const band = 0.3 * sd
  const ups = [] // times of upward crossings
  let low = false
  for (const x of s) {
    if (x.v < mean - band) low = true
    else if (low && x.v > mean + band) { ups.push(x.t); low = false }
  }
  if (ups.length < 3) return null // need at least 2 full breaths between crossings
  const rate = ((ups.length - 1) / (ups.at(-1) - ups[0])) * 60000
  return rate >= 4 && rate <= 40 ? Math.round(rate * 10) / 10 : null
}

// Diagnostics on stderr (ends up in the sidecar log): what the SDK is actually sending.
const seen = { metrics: 0, hr: 0, br: 0, lastHr: null, lastBr: null }
const diag = setInterval(() => {
  console.error('smartspectra diag', JSON.stringify(seen))
}, 5000)

// Waveform samples collected between trace emits.
const traceBuf = { pulse: [], breathing: [] }

sdk.on('metrics', (buf) => {
  const m = decodeMetrics(buf)
  for (const t of m.cardio?.arterialPressureTrace ?? []) if (t.value != null) traceBuf.pulse.push(t.value)
  for (const t of m.breathing?.upperTrace ?? []) {
    if (t.value == null) continue
    traceBuf.breathing.push(t.value)
    addBreathSample(t, Date.now())
  }
  const hr = m.cardio?.pulseRate?.at(-1)
  const br = m.breathing?.rate?.at(-1)
  seen.metrics++
  if (hr) { seen.hr++; seen.lastHr = hr }
  if (br) { seen.br++; seen.lastBr = br }
  const now = Date.now()
  if (hr?.value != null) hrTrack.add(hr, now)
  if (br?.value != null) brTrack.add(br, now)
})
const emit = (obj) => process.stdout.write(JSON.stringify(obj) + '\n')

// Positioning tips ("Increase light on face."), forwarded only when they change.
let lastHint = ''
sdk.on('validationStatus', (_code, _ts, hint) => {
  if ((hint || '') !== lastHint) {
    lastHint = hint || ''
    emit({ type: 'hint', text: lastHint })
  }
})

// Live preview: downscale the SDK's frame to PREVIEW_W wide and JPEG-encode it.
const PREVIEW_W = 320
const PREVIEW_INTERVAL_MS = 125 // ~8 fps
let lastPreview = 0
sdk.on('videoOutput', (buf, width, height, stride, fmt) => {
  const now = Date.now()
  if (now - lastPreview < PREVIEW_INTERVAL_MS) return
  const order = { [PixelFormat.kRGB]: [0, 1, 2, 3], [PixelFormat.kBGR]: [2, 1, 0, 3],
    [PixelFormat.kRGBA]: [0, 1, 2, 4], [PixelFormat.kBGRA]: [2, 1, 0, 4] }[fmt]
  if (!order) return // YUV formats: skip preview rather than show garbage
  lastPreview = now
  const [r, g, b, bpp] = order
  const step = width / PREVIEW_W
  const w = PREVIEW_W
  const h = Math.round(height / step)
  const out = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) {
    const row = Math.floor(y * step) * stride
    for (let x = 0; x < w; x++) {
      const i = row + Math.floor(x * step) * bpp
      const o = (y * w + x) * 4
      out[o] = buf[i + r]; out[o + 1] = buf[i + g]; out[o + 2] = buf[i + b]; out[o + 3] = 255
    }
  }
  emit({ type: 'frame', jpeg: jpeg.encode({ data: out, width: w, height: h }, 60).data.toString('base64') })
})
sdk.on('error', (code, message) => console.error('smartspectra error', code, message))

// Live waveforms, ~4x per second. Only sent when there's something new.
const traceTimer = setInterval(() => {
  if (!traceBuf.pulse.length && !traceBuf.breathing.length) return
  emit({ type: 'trace', pulse: traceBuf.pulse.splice(0), breathing: traceBuf.breathing.splice(0) })
}, 250)

// Emit once per second. Trackers only hold filtered values, so anything they return is reliable.
const timer = setInterval(() => {
  const now = Date.now()
  const hr = hrTrack.current(now)
  // The SDK's filtered rate wins; until it settles, fall back to counting breaths in the waveform.
  // The waveform estimate has no confidence score, so it doesn't change quality (q: null).
  const wave = waveformBreathingRate(now)
  const br = brTrack.current(now) ?? (wave != null ? { value: wave, q: null } : null)
  emit({
    type: 'reading',
    heart_rate: hr?.value ?? null,
    breathing_rate: br?.value ?? null,
    // A signal without a confidence score doesn't lower quality; reaching here means it passed the filter.
    quality: hr || br ? Math.min(hr?.q ?? 1, br?.q ?? 1) : 0,
    reliable: Boolean(hr || br),
  })
}, 1000)

sdk.useCamera(CameraSelection.default)
sdk.start()

let stopping = false
async function shutdown() {
  if (stopping) return
  stopping = true
  clearInterval(timer)
  clearInterval(diag)
  clearInterval(traceTimer)
  try { await sdk.stopAsync(); await sdk.destroy() } catch { /* camera already released */ }
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
