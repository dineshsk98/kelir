import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { api, ApiError, type Me } from './api'
import { CapsuleEditor } from './pages/CapsuleEditor'
import { History } from './pages/History'
import { NotFound } from './pages/NotFound'
import { RecipientCapsule } from './pages/RecipientCapsule'
import { Welcome } from './pages/Welcome'

// Dev-only preview of the opening: excluded from production builds entirely
const DevReveal = import.meta.env.DEV
  ? lazy(() => import('./pages/DevReveal').then((m) => ({ default: m.DevReveal })))
  : null

export function App() {
  return (
    <Routes>
      {/* The recipient has no account: their page never checks for a session */}
      <Route path="/c/:secret" element={<RecipientCapsule />} />
      {DevReveal && (
        <Route
          path="/dev/reveal"
          element={
            <Suspense fallback={null}>
              <DevReveal />
            </Suspense>
          }
        />
      )}
      <Route path="*" element={<SenderApp />} />
    </Routes>
  )
}

// undefined = still checking the session; null = signed out
type Session = Me | null | undefined

function SenderApp() {
  const [me, setMe] = useState<Session>(undefined)

  useEffect(() => {
    api
      .me()
      .then(setMe)
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) console.error(e)
        setMe(null)
      })
  }, [])

  if (me === undefined) return null

  const signOut = async () => {
    await api.signOut()
    setMe(null)
  }

  return (
    <Routes>
      <Route path="/" element={me ? <Navigate to="/history" replace /> : <Welcome onSignedIn={setMe} />} />
      <Route
        path="/history"
        element={me ? <History me={me} onSignOut={signOut} /> : <Navigate to="/" replace />}
      />
      <Route path="/capsules/new" element={me ? <CapsuleEditor me={me} /> : <Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
