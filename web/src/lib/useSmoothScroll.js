import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

/** Lenis smooth scrolling for the whole site. Off when the user prefers reduced motion. */
export function useSmoothScroll() {
  const lenisRef = useRef(null)
  const { pathname } = useLocation()

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true })
    lenisRef.current = lenis
    let frame
    const raf = (time) => {
      lenis.raf(time)
      frame = requestAnimationFrame(raf)
    }
    frame = requestAnimationFrame(raf)
    return () => {
      cancelAnimationFrame(frame)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  // New page: glide back to the top with Lenis (instant if motion is reduced).
  useEffect(() => {
    if (lenisRef.current) lenisRef.current.scrollTo(0, { duration: 0.8, easing: (t) => 1 - Math.pow(1 - t, 3) })
    else window.scrollTo(0, 0)
  }, [pathname])
}
