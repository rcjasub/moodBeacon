import { useEffect, useRef, useState } from 'react'

// One shooting star at a time: starts at a random edge, streaks across, then waits a moment.
function newStar() {
  const { innerWidth: w, innerHeight: h } = window
  const side = Math.floor(Math.random() * 4)
  const [x, y, angle] = [
    [Math.random() * w, 0, 45],
    [w, Math.random() * h, 135],
    [Math.random() * w, h, 225],
    [0, Math.random() * h, 315],
  ][side]
  return { id: Date.now(), x, y, angle, scale: 1, speed: Math.random() * 12 + 8, distance: 0 }
}

export default function ShootingStars({ starColor = '#4811A6', trailColor = '#DC5F28', minDelay = 1500, maxDelay = 4500, width = 14, height = 1.5 }) {
  const [star, setStar] = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const spawn = () => {
      setStar(newStar())
      timer.current = setTimeout(spawn, Math.random() * (maxDelay - minDelay) + minDelay)
    }
    spawn()
    return () => clearTimeout(timer.current)
  }, [minDelay, maxDelay])

  useEffect(() => {
    if (!star) return undefined
    let frame
    const move = () => {
      setStar((s) => {
        if (!s) return s
        const rad = (s.angle * Math.PI) / 180
        const x = s.x + s.speed * Math.cos(rad)
        const y = s.y + s.speed * Math.sin(rad)
        const { innerWidth: w, innerHeight: h } = window
        if (x < -40 || x > w + 40 || y < -40 || y > h + 40) return null
        return { ...s, x, y, distance: s.distance + s.speed, scale: 1 + (s.distance + s.speed) / 100 }
      })
      frame = requestAnimationFrame(move)
    }
    frame = requestAnimationFrame(move)
    return () => cancelAnimationFrame(frame)
  }, [star?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <svg className="sky-layer" aria-hidden="true">
      <defs>
        <linearGradient id="shooting-star-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={trailColor} stopOpacity="0" />
          <stop offset="100%" stopColor={starColor} stopOpacity="1" />
        </linearGradient>
      </defs>
      {star && (
        <rect x={star.x} y={star.y} width={width * star.scale} height={height} fill="url(#shooting-star-gradient)"
          transform={`rotate(${star.angle}, ${star.x + (width * star.scale) / 2}, ${star.y + height / 2})`} />
      )}
    </svg>
  )
}
