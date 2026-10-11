import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import NavBar from './components/NavBar.jsx'
import CrisisFooter from './components/CrisisFooter.jsx'
import ShootingStars from './components/Sky/ShootingStars.jsx'
import StarsBackground from './components/Sky/StarsBackground.jsx'
import Today from './pages/Today.jsx'
import Camera from './pages/Camera.jsx'
import Timeline from './pages/Timeline.jsx'
import Privacy from './pages/Privacy.jsx'
import Plan from './pages/Plan.jsx'
import { useSmoothScroll } from './lib/useSmoothScroll.js'

// Loaded on demand so three.js only downloads when the page is opened.
const LetItGo = lazy(() => import('./pages/LetItGo.jsx'))

export default function App() {
  useSmoothScroll()
  return (
    <>
      <div className="sky" aria-hidden="true">
        <StarsBackground />
        <ShootingStars />
      </div>
      <div className="shell">
        <NavBar />
        <main className="card">
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/camera" element={<Camera />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/plan" element={<Plan />} />
            <Route path="/let-it-go" element={<Suspense fallback={null}><LetItGo /></Suspense>} />
          </Routes>
        </main>
        <CrisisFooter />
      </div>
    </>
  )
}
