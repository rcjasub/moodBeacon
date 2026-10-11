// Bright chart palette, checked for colorblind separation (dataviz validator).
// The rest of the app is black and white; color lives only in the charts.
export const REPORTED = '#10B981' // emerald: what you reported (sleep)
export const MEASURED = '#6366F1' // indigo: what the camera measured (heart rate)
export const MEASURED_2 = '#0EA5E9' // sky: second camera measure (breathing)
export const HIGH = '#EF4444' // red: highlights (flags, hovered points)

// Mood runs cool to warm: indigo (low) → sky → emerald (steady) → amber → red (very high).
export const MOOD_COLOR = {
  low: '#6366F1', slightly_low: '#0EA5E9', steady: '#10B981', lifted: '#F59E0B', very_high: '#EF4444',
}
