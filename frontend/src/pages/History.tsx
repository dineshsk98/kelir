import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Capsule, type Me } from '../api'
import { StatusBadge } from '../components/StatusBadge'
import { deliveryLine } from '../format'
import './History.css'

export function History({ me, onSignOut }: { me: Me; onSignOut: () => void }) {
  const firstName = me.name.split(' ')[0]
  const [capsules, setCapsules] = useState<Capsule[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    api
      .listCapsules()
      .then(setCapsules)
      .catch(() => setError(true))
  }, [])

  return (
    <main className="page">
      <header className="topbar">
        <span className="brand">Birthday Capsule</span>
        <span>
          <span className="muted">{me.email}</span>
          <button className="btn btn-quiet" onClick={onSignOut}>
            Sign out
          </button>
        </span>
      </header>

      <div className="history-head">
        <div>
          <h1>Hi {firstName}</h1>
          <p className="muted">Your capsules</p>
        </div>
        {capsules && capsules.length > 0 && (
          <Link to="/capsules/new" className="btn">
            New capsule
          </Link>
        )}
      </div>

      {error && <p className="error">We couldn't load your capsules. Please reload the page.</p>}

      {capsules && capsules.length === 0 && (
        <section className="card" style={{ textAlign: 'center', marginTop: 24 }}>
          <p style={{ fontSize: '2.5rem', margin: 0 }} aria-hidden>
            🎁
          </p>
          <h2>Make your first capsule</h2>
          <p className="muted">Think of someone whose birthday is coming up. Be the first to wish them.</p>
          <Link to="/capsules/new" className="btn">
            New capsule
          </Link>
        </section>
      )}

      {capsules && capsules.length > 0 && (
        <ul className="capsule-list">
          {capsules.map((c) => (
            <li key={c.id} className="capsule-row">
              <div className="capsule-row-main">
                <p className="capsule-to">
                  <strong>{c.recipient_name}</strong> <span className="muted">· {c.city_label}</span>
                </p>
                <p className="capsule-when">{deliveryLine(c)}</p>
              </div>
              <StatusBadge status={c.status} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
