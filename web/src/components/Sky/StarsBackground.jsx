import { useEffect, useRef } from 'react'

// Twinkling star field drawn on a canvas. Deep purple stars, so it reads on a white page.
export default function StarsBackground({ density = 0.00012, color = '72,17,166', twinkleChance = 0.7 }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let stars = []
    let frame

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const { innerWidth: w, innerHeight: h } = window
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      stars = Array.from({ length: Math.floor(w * h * density) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 0.8 + 0.4,
        o: Math.random() * 0.35 + 0.15,
        twinkle: Math.random() < twinkleChance,
        speed: Math.random() * 0.5 + 0.5,
      }))
    }

    const draw = (t) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const s of stars) {
        const o = s.twinkle && !still ? s.o * (0.55 + 0.45 * Math.sin(t * 0.001 * s.speed + s.x)) : s.o
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${color},${o})`
        ctx.fill()
      }
      if (!still) frame = requestAnimationFrame(draw)
    }

    resize()
    frame = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize) }
  }, [density, color, twinkleChance])

  return <canvas ref={ref} className="sky-layer" aria-hidden="true" />
}
