import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAccountWatch } from './account'
import { api, ApiError, type Me } from './api'
import { CapsuleDetail } from './pages/CapsuleDetail'
import { CapsuleEditor, EditCapsule } from './pages/CapsuleEditor'
import { History } from './pages/History'
import { NotFound } from './pages/NotFound'
import { People } from './pages/People'
import { Received } from './pages/Received'
import { ReceivedCapsule, RecipientCapsule } from './pages/RecipientCapsule'
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

  // Another tab may sign in as someone else, or sign out: follow it (account.ts)
  const signedOutElsewhere = useCallback(() => setMe(null), [])
  useAccountWatch(me, signedOutElsewhere)

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
        element={me ? <History me={me} onSignOut={signOut} onMeChange={setMe} /> : <Navigate to="/" replace />}
      />
      <Route
        path="/received"
        element={me ? <Received me={me} onSignOut={signOut} onMeChange={setMe} /> : <Navigate to="/" replace />}
      />
      <Route path="/received/:id" element={me ? <ReceivedCapsule /> : <Navigate to="/" replace />} />
      <Route path="/people" element={me ? <People me={me} onSignOut={signOut} onMeChange={setMe} /> : <Navigate to="/" replace />} />
      <Route path="/capsules/new" element={me ? <CapsuleEditor me={me} /> : <Navigate to="/" replace />} />
      <Route path="/capsules/:id" element={me ? <CapsuleDetail /> : <Navigate to="/" replace />} />
      <Route path="/capsules/:id/edit" element={me ? <EditCapsule me={me} /> : <Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
