// BipolarBird mark: "BB" in a blue circle.
export default function Logo({ size = 28, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true" style={style}>
      <circle cx="15" cy="15" r="13.5" fill="#2563EB" />
      <text x="15" y="15.5" textAnchor="middle" dominantBaseline="central" fill="#fff"
        fontFamily="'Outfit', 'Inter Tight', system-ui, sans-serif" fontWeight="600" fontSize="12.5" letterSpacing="-0.4">
        BB
      </text>
    </svg>
  )
}
