import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <main className="page">
      <header className="topbar">
        <Link to="/" className="brand">
          Birthday Capsule
        </Link>
      </header>
      <h1>We couldn't find that page</h1>
      <p className="muted">
        <Link to="/">Go to the start</Link>
      </p>
    </main>
  )
}
