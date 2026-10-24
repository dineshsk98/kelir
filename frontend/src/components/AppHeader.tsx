import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ACCOUNT_CONFIRMED } from '../account'
import { api, ApiError, type Me } from '../api'
import './AppHeader.css'
import { Wordmark } from './Wordmark'

const TITLE = 'Kelir'

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

/** Change your name: it is how recipients see you ("Sam has sent you a surprise"). */
function NameEdit({ me, onSaved, onClose }: { me: Me; onSaved: (me: Me) => void; onClose: () => void }) {
  const [name, setName] = useState(me.name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Enter your name')
    if (trimmed === me.name) return onClose()
    setSaving(true)
    try {
      onSaved(await api.updateMe(trimmed))
      onClose()
    } catch (err) {
      setError(err instanceof ApiError && err.status === 422 ? "That name can't be used" : "We couldn't save that. Please try again.")
      setSaving(false)
    }
  }

  return (
    <form className="name-edit" onSubmit={save} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <label className="field-label" htmlFor="name-edit-input">
        Your name
        <span className="muted field-hint"> · recipients see it in their birthday email</span>
      </label>
      <div className="name-edit-row">
        <input
          id="name-edit-input"
          className="input"
          value={name}
          maxLength={120}
          autoFocus
          aria-invalid={!!error}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
        />
        <button type="submit" className="btn" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-quiet" onClick={onClose}>
          Cancel
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  )
}

/** The signed-in app's header: Sent, Received and People, and who's signed in. One account
 *  both sends and receives (prd.md > Received). */
export function AppHeader({
  me,
  onSignOut,
  onMeChange,
}: {
  me: Me
  onSignOut: () => void
  onMeChange: (me: Me) => void
}) {
  const tab = ({ isActive }: { isActive: boolean }) => (isActive ? 'app-tab active' : 'app-tab')
  const unread = useUnread()
  const [editingName, setEditingName] = useState(false)
  return (
    <header className="app-header">
      <div className="topbar">
        <NavLink to="/history" className="brand">
          <Wordmark className="wordmark-sm" />
        </NavLink>
        <span className="topbar-user">
          <button
            type="button"
            className="btn btn-quiet topbar-name"
            aria-expanded={editingName}
            title="Change your name"
            onClick={() => setEditingName((v) => !v)}
          >
            {me.name} <span aria-hidden="true">✎</span>
          </button>
          <span className="muted topbar-email">{me.email}</span>
          <button className="btn btn-quiet" onClick={onSignOut}>
            Sign out
          </button>
        </span>
      </div>
      {editingName && <NameEdit me={me} onSaved={onMeChange} onClose={() => setEditingName(false)} />}
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
