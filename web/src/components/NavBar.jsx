import { Link, NavLink } from 'react-router-dom'
import Logo from './Logo.jsx'

const ITEMS = [
  ['/', 'Today'],
  ['/camera', 'Camera session'],
  ['/timeline', 'Timeline'],
  ['/let-it-go', 'Let it go'],
  ['/privacy', 'Privacy and data'],
]

function SwapLabel({ text }) {
  return text.split('').map((ch, i) => (
    <span key={i} className="l" aria-hidden="true" style={{ '--d': ((i * 7 + 3) % 11) * 0.03 + 's' }}>
      <i data-c={ch}>{ch}</i>
    </span>
  ))
}

export default function NavBar() {
  return (
    <nav aria-label="Primary" className="topnav">
      <Link to="/" className="brand">
        <Logo />
        <span>BipolarBird</span>
      </Link>
      <div className="links">
        {ITEMS.map(([to, label]) => (
          <NavLink key={to} to={to} end className={({ isActive }) => 'swap' + (isActive ? ' active' : '')} aria-label={label}>
            <SwapLabel text={label} />
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
