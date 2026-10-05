import { useState } from 'react'
import { api, type Me, type SignedIn } from '../api'
import { SignInChoice } from '../components/SignIn'
import './Welcome.css'

export function Welcome({ onSignedIn }: { onSignedIn: (me: Me) => void }) {
  // A new account made by email code: ask what recipients should call them first
  const [naming, setNaming] = useState<SignedIn | null>(null)

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
          {naming ? (
            <NameStep me={naming} onDone={onSignedIn} />
          ) : (
            <>
              <SignInChoice onSignedIn={(me) => (me.created ? setNaming(me) : onSignedIn(me))} />
              <p className="muted small welcome-received">Got a capsule? Sign in with the email it was sent to.</p>
            </>
          )}
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

/** "What should we call you?": recipients see this name in the birthday email */
function NameStep({ me, onDone }: { me: Me; onDone: (me: Me) => void }) {
  const [name, setName] = useState(me.name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="welcome-name"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return setError('Enter your name')
        setSaving(true)
        try {
          onDone(await api.updateMe(name.trim()))
        } catch {
          setError("We couldn't save that. Please try again.")
          setSaving(false)
        }
      }}
    >
      <label className="field-label" htmlFor="welcome-name">
        What should we call you?
        <span className="muted field-hint"> · Recipients see this name in their birthday email</span>
      </label>
      <input
        id="welcome-name"
        className="input"
        value={name}
        maxLength={120}
        autoFocus
        onChange={(e) => {
          setName(e.target.value)
          setError(null)
        }}
      />
      {error && <p className="error">{error}</p>}
      <button type="submit" className="btn" disabled={saving}>
        {saving ? 'Saving…' : 'Continue'}
      </button>
    </form>
  )
}
