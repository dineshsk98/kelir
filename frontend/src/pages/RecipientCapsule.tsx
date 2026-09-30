import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, ApiError, type RecipientCapsule as Capsule } from '../api'
import './RecipientCapsule.css'

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; capsule: Capsule }
  | { kind: 'not-found' }
  | { kind: 'cancelled' }
  | { kind: 'error' }

/** The recipient's private page. A plain card for now; slice 6 swaps in the staged <Reveal>. */
export function RecipientCapsule() {
  const { secret = '' } = useParams()
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    // Private page: keep it out of search engines even when reached inside the app
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow'
    document.head.appendChild(robots)
    return () => robots.remove()
  }, [])

  useEffect(() => {
    api
      .openCapsule(secret)
      .then((capsule) => setState({ kind: 'ready', capsule }))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setState({ kind: 'not-found' })
        else if (e instanceof ApiError && e.status === 410) setState({ kind: 'cancelled' })
        else setState({ kind: 'error' })
      })
  }, [secret])

  if (state.kind === 'loading') return <main className="page recipient" aria-busy="true" />
  if (state.kind !== 'ready') {
    const text = {
      'not-found': ["We couldn't find this capsule", 'Check that you opened the whole link from your email.'],
      cancelled: ['This capsule is no longer available', 'The person who made it has taken it back.'],
      error: ["Something went wrong", 'Please try opening the link again in a moment.'],
    }[state.kind]
    return (
      <main className="page recipient">
        <div className="card recipient-card">
          <h1>{text[0]}</h1>
          <p className="muted">{text[1]}</p>
        </div>
      </main>
    )
  }

  const c = state.capsule
  const firstName = c.recipient_name.split(' ')[0]
  return (
    <main className="page recipient">
      <article className="card recipient-card">
        <p className="muted small">A capsule from {c.sender_name}</p>
        <h1>Happy birthday, {firstName}!</h1>
        {c.message_text && <p className="recipient-message">{c.message_text}</p>}
        {c.gift_kind && <Gift capsule={c} />}
        <p className="muted small signature">With love, {c.sender_name}</p>
      </article>
    </main>
  )
}

function Gift({ capsule: c }: { capsule: Capsule }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(c.gift_value ?? '')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setRevealed(true) // no clipboard access: at least the code is visible to copy by hand
    }
  }

  return (
    <section className="recipient-gift" aria-label="Your gift">
      <p className="small muted">A gift for you</p>
      {c.gift_note && <p className="gift-note">{c.gift_note}</p>}
      {c.gift_kind === 'link' ? (
        // noreferrer: the gift site never sees this page's private URL
        <a className="btn" href={c.gift_value ?? '#'} target="_blank" rel="noopener noreferrer">
          Open your gift
        </a>
      ) : revealed ? (
        <div className="gift-code-row">
          <code className="gift-code-value">{c.gift_value}</code>
          <button type="button" className="btn" onClick={copy}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      ) : (
        <button type="button" className="gift-code-hidden" onClick={() => setRevealed(true)}>
          Tap to reveal your code
        </button>
      )}
    </section>
  )
}
