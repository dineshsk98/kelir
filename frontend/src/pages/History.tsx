import type { Me } from '../api'

export function History({ me, onSignOut }: { me: Me; onSignOut: () => void }) {
  const firstName = me.name.split(' ')[0]

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

      <h1>Hi {firstName}</h1>
      <p className="muted">Your capsules will appear here.</p>

      <section className="card" style={{ textAlign: 'center', marginTop: 24 }}>
        <p style={{ fontSize: '2.5rem', margin: 0 }} aria-hidden>
          🎁
        </p>
        <h2>Make your first capsule</h2>
        <p className="muted">Think of someone whose birthday is coming up. Be the first to wish them.</p>
        {/* Slice 3 turns this into the capsule editor */}
        <button className="btn" disabled title="Coming in the next step">
          New capsule
        </button>
      </section>
    </main>
  )
}
