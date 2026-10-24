import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ACCOUNT_CONFIRMED } from '../account'
import { api, type Me, type ReceivedCapsule } from '../api'
import { AppHeader } from '../components/AppHeader'
import './Received.css'

const arrived = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))

/** The capsules sent to your email, newest first (prd.md > Received). A lost link doesn't
 *  lose the capsule: open it here the same way, once, then see what was inside. */
export function Received({
  me,
  onSignOut,
  onMeChange,
}: {
  me: Me
  onSignOut: () => void
  onMeChange: (me: Me) => void
}) {
  const [capsules, setCapsules] = useState<ReceivedCapsule[] | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    api
      .listReceived()
      .then((list) => {
        setCapsules(list)
        setError(false)
      })
      .catch(() => setError(true))
  }, [])

  useEffect(() => {
    load()
    // A capsule can arrive while the page is open: refresh when the tab comes back
    window.addEventListener(ACCOUNT_CONFIRMED, load)
    return () => window.removeEventListener(ACCOUNT_CONFIRMED, load)
  }, [load])

  return (
    <main className="page">
      <AppHeader me={me} onSignOut={onSignOut} onMeChange={onMeChange} />
      <h1>Received</h1>

      {error && <p className="error">We couldn't load your capsules. Please reload the page.</p>}

      {capsules && capsules.length === 0 && (
        <section className="card received-empty">
          <p className="received-empty-icon" aria-hidden="true">
            🎁
          </p>
          <h2>Nothing here yet</h2>
          <p className="muted">Capsules sent to you appear here.</p>
        </section>
      )}

      {capsules && capsules.length > 0 && (
        <ul className="received-list">
          {capsules.map((c) => (
            <li key={c.id}>
              <Link to={`/received/${c.id}`} className={c.opened_at ? 'received-row' : 'received-row new'}>
                <span className="received-from">
                  From <strong>{c.sender_name}</strong>
                </span>
                <span className="muted small">
                  Arrived {arrived(c.delivered_at)}
                  {c.replied && ' · You said thank you'}
                </span>
                <span className={c.opened_at ? 'badge badge-opened' : 'badge received-new'}>
                  {c.opened_at ? 'Opened' : 'New · open it'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
