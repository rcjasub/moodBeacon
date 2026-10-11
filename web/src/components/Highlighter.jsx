import { useEffect, useRef } from 'react'
import { useInView } from 'framer-motion'
import { annotate } from 'rough-notation'

// Hand-drawn highlight / underline / circle around inline text (rough-notation).
// Ported from Magic UI's Highlighter. Draws once the text scrolls into view and redraws on resize.
export default function Highlighter({
  children,
  action = 'highlight', // highlight | underline | box | circle | strike-through | crossed-off | bracket
  color = '#E3D67D',
  strokeWidth = 1.5,
  animationDuration = 600,
  iterations = 2,
  padding = 2,
  multiline = true,
  delay = 0,
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-10%' })

  useEffect(() => {
    const el = ref.current
    if (!el || !inView) return undefined
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const a = annotate(el, {
      type: action, color, strokeWidth, iterations, padding, multiline,
      animate: !still, animationDuration,
    })
    const timer = setTimeout(() => a.show(), delay)
    // Re-draw when the text reflows so the marks stay attached to the words.
    let width = document.body.clientWidth
    const ro = new ResizeObserver(() => {
      if (document.body.clientWidth === width) return
      width = document.body.clientWidth
      a.hide(); a.show()
    })
    const startObserving = setTimeout(() => ro.observe(document.body), delay + animationDuration)
    return () => { clearTimeout(timer); clearTimeout(startObserving); ro.disconnect(); a.remove() }
  }, [inView, action, color, strokeWidth, animationDuration, iterations, padding, multiline, delay])

  return <span ref={ref} style={{ position: 'relative', display: 'inline', background: 'transparent' }}>{children}</span>
}
