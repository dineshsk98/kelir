import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ACCOUNT_CONFIRMED } from '../account'
import { api, type Me } from '../api'
import './AppHeader.css'

const TITLE = 'Birthday Capsule'

/** Received capsules not opened yet, like unread mail: on the tab and in the window title.
 *  Fetched on every page (the header comes with each) and when the tab comes back. */
function useUnread(): number {
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    const load = () =>
      api
        .unreadCount()
        .then((r) => setUnread(r.unread))
        .catch(() => {}) // only a counter: leave it as it was
    load()
    window.addEventListener(ACCOUNT_CONFIRMED, load)
    return () => window.removeEventListener(ACCOUNT_CONFIRMED, load)
  }, [])
  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) ${TITLE}` : TITLE
    return () => {
      document.title = TITLE
    }
  }, [unread])
  return unread
}

/** The signed-in app's header: Sent, Received and People, and who's signed in. One account
 *  both sends and receives (prd.md > Received). */
export function AppHeader({ me, onSignOut }: { me: Me; onSignOut: () => void }) {
  const tab = ({ isActive }: { isActive: boolean }) => (isActive ? 'app-tab active' : 'app-tab')
  const unread = useUnread()
  return (
    <header className="app-header">
      <div className="topbar">
        <NavLink to="/history" className="brand">
          Birthday Capsule
        </NavLink>
        <span>
          <span className="muted">{me.email}</span>
          <button className="btn btn-quiet" onClick={onSignOut}>
            Sign out
          </button>
        </span>
      </div>
      <nav className="app-tabs" aria-label="Your capsules">
        <NavLink to="/history" className={tab}>
          Sent
        </NavLink>
        <NavLink to="/received" className={tab}>
          Received
          {unread > 0 && (
            <span className="app-tab-count" aria-label={`${unread} not opened yet`}>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </NavLink>
        <NavLink to="/people" className={tab}>
          People
        </NavLink>
      </nav>
    </header>
  )
}
