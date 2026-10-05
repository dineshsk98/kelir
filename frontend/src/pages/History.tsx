import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Capsule, type CapsuleStatus, type Me } from '../api'
import { AppHeader } from '../components/AppHeader'
import { StatusBadge } from '../components/StatusBadge'
import { ACCOUNT_CONFIRMED } from '../account'
import { deliveryLine } from '../format'
import './History.css'

const FILTERS: { key: CapsuleStatus; label: string }[] = [
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'opened', label: 'Opened' },
  { key: 'cancelled', label: 'Cancelled' },
]

export function History({ me, onSignOut }: { me: Me; onSignOut: () => void }) {
  const firstName = me.name.split(' ')[0]
  const [capsules, setCapsules] = useState<Capsule[] | null>(null)
  const [error, setError] = useState(false)
  const [demoMode, setDemoMode] = useState(false)
  const [simulating, setSimulating] = useState<string | null>(null)
  const [filter, setFilter] = useState<CapsuleStatus | 'all'>('all')

  const load = useCallback(() => {
    api
      .listCapsules()
      .then((list) => {
        setCapsules(list)
        setError(false)
      })
      .catch(() => setError(true))
  }, [])

  useEffect(() => {
    load()
    api
      .config()
      .then((c) => setDemoMode(c.demo_mode))
      .catch(() => {})
    // Statuses change elsewhere (their midnight, their first open): refresh when the tab comes
    // back, once the app has confirmed it's still the same account (App.tsx)
    window.addEventListener(ACCOUNT_CONFIRMED, load)
    return () => window.removeEventListener(ACCOUNT_CONFIRMED, load)
  }, [load])

  const simulate = async (id: string) => {
    setSimulating(id)
    try {
      const updated = await api.simulateMidnight(id)
      setCapsules((list) => list?.map((c) => (c.id === id ? updated : c)) ?? null)
    } catch {
      load()
    } finally {
      setSimulating(null)
    }
  }

  const counts = (status: CapsuleStatus) => capsules?.filter((c) => c.status === status).length ?? 0
  // A filter that has emptied out (the last scheduled one just went out) falls back to All
  const active = filter !== 'all' && counts(filter) === 0 ? 'all' : filter
  const shown = capsules?.filter((c) => active === 'all' || c.status === active) ?? []

  return (
    <main className="page">
      <AppHeader me={me} onSignOut={onSignOut} />

      <div className="history-head">
        <h1>Hi {firstName}</h1>
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
        <div className="capsule-filters" role="group" aria-label="Filter by status">
          {[{ key: 'all' as const, label: 'All', count: capsules.length }, ...FILTERS.map((f) => ({ ...f, count: counts(f.key) }))]
            .filter((f) => f.key === 'all' || f.count > 0)
            .map((f) => (
              <button
                key={f.key}
                type="button"
                className="filter-chip"
                aria-pressed={active === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.label} <span className="filter-count">{f.count}</span>
              </button>
            ))}
        </div>
      )}

      {capsules && capsules.length > 0 && (
        <ul className="capsule-list">
          {shown.map((c) => (
            <li key={c.id} className="capsule-row">
              <div className="capsule-row-main">
                <p className="capsule-to">
                  <Link to={`/capsules/${c.id}`} className="capsule-link">
                    <strong>{c.recipient_name}</strong>
                  </Link>{' '}
                  <span className="muted">· {c.city_label}</span>
                </p>
                <p className={c.delivery_trouble ? 'capsule-when error' : 'capsule-when'}>{deliveryLine(c)}</p>
                {c.reply && (
                  <blockquote className="capsule-reply">
                    <span className="capsule-reply-text">“{c.reply.text}”</span>
                    <span className="muted small"> — {c.recipient_name.split(' ')[0]}</span>
                  </blockquote>
                )}
                {demoMode && c.status === 'scheduled' && (
                  <button
                    type="button"
                    className="demo-button"
                    disabled={simulating === c.id}
                    onClick={() => simulate(c.id)}
                  >
                    <span className="demo-tag">Demo</span>
                    {simulating === c.id ? 'Delivering…' : 'Simulate their midnight'}
                  </button>
                )}
              </div>
              <StatusBadge status={c.status} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
