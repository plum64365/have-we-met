import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Logo } from './components/ui.tsx'
import { isConfigured } from './lib/supabase.ts'
import Home from './pages/Home.tsx'
import Host from './pages/Host.tsx'
import Play from './pages/Play.tsx'
import Wizard from './pages/Wizard.tsx'

// Design preview with fake data. Dev server only: this import is dropped from production builds.
const Preview = import.meta.env.DEV ? lazy(() => import('./pages/Preview.tsx')) : null

function NotConfigured() {
  return (
    <main className="phone">
      <Logo />
      <div className="card pad">
        <h2>Almost there</h2>
        <p>
          The app is not connected to Supabase yet. Copy <code>.env.example</code> to <code>.env.local</code>, fill in{' '}
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart <code>npm run dev</code>.
        </p>
        <p>The full steps are in SETUP.md.</p>
      </div>
    </main>
  )
}

export default function App() {
  if (Preview && window.location.pathname.startsWith('/preview')) {
    return (
      <Suspense fallback={null}>
        <Preview />
      </Suspense>
    )
  }
  if (!isConfigured) return <NotConfigured />
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/host" element={<Host />} />
        <Route path="/play" element={<Play />} />
        <Route path="/play/:code" element={<Play />} />
        {/* Not linked from anywhere: the teammate running the Wizard of Oz console types the URL. */}
        <Route path="/wizard/:code" element={<Wizard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
