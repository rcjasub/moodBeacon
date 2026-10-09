export const MOODS = [
  { id: 'low', label: 'Low' },
  { id: 'slightly_low', label: 'A bit low' },
  { id: 'steady', label: 'Steady' },
  { id: 'lifted', label: 'Lifted' },
  { id: 'very_high', label: 'Very high' },
]

export const ENERGIES = [
  { id: 'very_low', label: 'Very low' },
  { id: 'lower', label: 'Lower than usual' },
  { id: 'usual', label: 'Usual' },
  { id: 'higher', label: 'Higher than usual' },
  { id: 'very_high', label: 'Hard to slow down' },
]

export const labelOf = (list, id) => list.find((x) => x.id === id)?.label ?? id

export function todayISO() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export function longDate(d = new Date()) {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

export function relativeTime(iso) {
  if (!iso) return null
  const d = new Date(iso)
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000)
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (days === 0) return `today, ${time}`
  if (days === 1) return `yesterday, ${time}`
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`
}

export const shortDay = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
