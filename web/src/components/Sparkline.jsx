/** Tiny inline line chart. Gaps (null values) break the line, so "No reading" stays visible. */
export default function Sparkline({ values, width = 280, height = 56, color = 'var(--ink)', min, max, pad = 2 }) {
  const nums = values.filter((v) => v != null)
  if (nums.length < 2) return <svg width={width} height={height} aria-hidden="true" />
  const span = Math.max(...nums) - Math.min(...nums)
  const margin = pad === 'auto' ? span * 0.1 : pad
  const lo = min ?? Math.min(...nums) - margin
  const hi = max ?? Math.max(...nums) + margin
  const x = (i) => (i / Math.max(values.length - 1, 1)) * width
  const y = (v) => height - ((v - lo) / (hi - lo || 1)) * height
  let d = ''
  let pen = false
  values.forEach((v, i) => {
    if (v == null) { pen = false; return }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `
    pen = true
  })
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ height }} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
