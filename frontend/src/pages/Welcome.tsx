import { useEffect, useState } from 'react'
import { api, ApiError, type Me } from '../api'
import { GoogleButton } from '../components/GoogleButton'
import './Welcome.css'

export function Welcome({ onSignedIn }: { onSignedIn: (me: Me) => void }) {
  const [clientId, setClientId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .config()
      .then((c) => setClientId(c.google_client_id))
      .catch(() => setError("We couldn't reach the server. Is the API running?"))
  }, [])

  const signIn = async (credential: string) => {
    setError(null)
    try {
      onSignedIn(await api.signInWithGoogle(credential))
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 401
          ? "Google couldn't confirm that sign-in. Please try again."
          : 'Sign-in failed. Please try again in a moment.',
      )
    }
  }

  return (
    <main className="page welcome">
      <header className="topbar">
        <span className="brand">Birthday Capsule</span>
      </header>

      <section className="welcome-hero">
        <p className="welcome-kicker">For the people you love, wherever they are</p>
        <h1>
          Be the first to wish them, <span className="hand">at their midnight.</span>
        </h1>
        <p className="muted welcome-lede">
          Record a message in your own words, voice or face. Add a little gift if you like. We deliver it by
          email the moment their birthday begins, 00:00 in their own time zone, and it opens like a present.
        </p>

        <div className="welcome-signin">
          {clientId ? (
            <GoogleButton clientId={clientId} onCredential={signIn} />
          ) : clientId === '' ? (
            <p className="error">Sign-in isn't set up yet: add GOOGLE_CLIENT_ID to .env and restart the API.</p>
          ) : null}
          {error && <p className="error">{error}</p>}
        </div>
      </section>

      <ol className="welcome-steps">
        <li>
          <strong>Pick someone.</strong> Their birthday and their city.
        </li>
        <li>
          <strong>Say it your way.</strong> Write, record your voice or a video.
        </li>
        <li>
          <strong>We wait for their midnight.</strong> Then it's in their inbox, ready to open.
        </li>
      </ol>
    </main>
  )
}
