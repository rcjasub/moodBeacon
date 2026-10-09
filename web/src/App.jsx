import { Route, Routes } from 'react-router-dom'
import NavBar from './components/NavBar.jsx'
import CrisisFooter from './components/CrisisFooter.jsx'
import Today from './pages/Today.jsx'
import Camera from './pages/Camera.jsx'
import Timeline from './pages/Timeline.jsx'
import Privacy from './pages/Privacy.jsx'
import Plan from './pages/Plan.jsx'
import { useSmoothScroll } from './lib/useSmoothScroll.js'

export default function App() {
  useSmoothScroll()
  return (
    <div className="shell">
      <NavBar />
      <main className="card">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/camera" element={<Camera />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/plan" element={<Plan />} />
        </Routes>
      </main>
      <CrisisFooter />
    </div>
  )
}
