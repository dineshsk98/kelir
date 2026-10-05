import { useState } from 'react'
import { api, type Me, type SignedIn } from '../api'
import { SignInChoice } from '../components/SignIn'
import './Welcome.css'

export function Welcome({ onSignedIn }: { onSignedIn: (me: Me) => void }) {
  // A new account made by email code: ask what recipients should call them first
  const [naming, setNaming] = useState<SignedIn | null>(null)

  return (
    <main className="welcome-split">
      <section className="welcome-left">
        <div className="welcome-left-inner">
          <div className="welcome-mark">
            <Logo />
            <span className="brand">Birthday Capsule</span>
          </div>
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
        </div>
      </section>

      <section className="welcome-right" aria-label="About Birthday Capsule">
        <div className="welcome-right-inner">
          <p className="welcome-kicker">For the people you love, wherever they are</p>
          <h1>
            Be the first to wish them, <span className="hand">at their midnight.</span>
          </h1>
          <p className="welcome-lede">
            Record a message in your own words, voice or face. Add a little gift if you like. We deliver it by
            email the moment their birthday begins, 00:00 in their own time zone, and it opens like a present.
          </p>

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
        </div>
      </section>
    </main>
  )
}

/** The mark: a wrapped gift with a candle */
function Logo() {
  return (
    <svg className="welcome-logo" viewBox="0 0 96 96" role="img" aria-label="Birthday Capsule logo">
      <circle cx="48" cy="48" r="46" fill="var(--color-accent-soft)" />
      <path d="M48 14c4 5 4 9 0 12-4-3-4-7 0-12z" fill="var(--capsule-band)" />
      <rect x="45.5" y="25" width="5" height="12" rx="2.5" fill="var(--color-text-muted)" />
      <rect x="22" y="37" width="52" height="14" rx="5" fill="var(--capsule-b)" />
      <rect x="26" y="51" width="44" height="29" rx="5" fill="var(--capsule-a)" />
      <rect x="44" y="37" width="8" height="43" fill="var(--capsule-band)" />
    </svg>
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
