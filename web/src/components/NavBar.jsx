import { MotionConfig, motion } from 'framer-motion'
import { Link, NavLink, useLocation } from 'react-router-dom'
import Logo from './Logo.jsx'

const ITEMS = [
  ['/', 'Today'],
  ['/camera', 'Camera session'],
  ['/timeline', 'Timeline'],
  ['/let-it-go', 'Let it go'],
  ['/privacy', 'Privacy and data'],
]

// The square behind the current tab slides to the new one (shared layoutId).
const SLIDE = { type: 'spring', stiffness: 380, damping: 34, mass: 0.9 }

export default function NavBar() {
  const { pathname } = useLocation()
  return (
    <nav aria-label="Primary" className="topnav">
      <Link to="/" className="brand">
        <Logo />
        <span>BipolarBird</span>
      </Link>
      <MotionConfig reducedMotion="user">
        <div className="links">
          {ITEMS.map(([to, label]) => {
            const active = to === '/' ? pathname === '/' : pathname.startsWith(to)
            return (
              <NavLink key={to} to={to} end className={active ? 'active' : undefined}>
                {active && <motion.span layoutId="nav-indicator" className="nav-indicator" transition={SLIDE} />}
                <span className="nav-label">{label}</span>
              </NavLink>
            )
          })}
        </div>
      </MotionConfig>
    </nav>
  )
}
