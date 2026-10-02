import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, mediaUrl, type Capsule } from '../api'
import { MediaGallery } from '../components/MediaGallery'
import { StatusBadge } from '../components/StatusBadge'
import { deliveryLine } from '../format'
import './CapsuleDetail.css'

/** One sent capsule: what it holds, where it is, the thank-you, and Edit/Cancel until opened. */
export function CapsuleDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [capsule, setCapsule] = useState<Capsule | null>(null)
  const [missing, setMissing] = useState(false)
  const [demoMode, setDemoMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getCapsule(id).then(setCapsule).catch(() => setMissing(true))
    api.config().then((c) => setDemoMode(c.demo_mode)).catch(() => {})
  }, [id])

  if (missing)
    return (
      <main className="page">
        <h1>We couldn't find that capsule</h1>
        <Link to="/history">Back to your capsules</Link>
      </main>
    )
  if (!capsule) return <main className="page" aria-busy="true" />

  const c = capsule
  const editable = c.status === 'scheduled' || c.status === 'delivered'

  const run = async (action: () => Promise<Capsule>) => {
    setBusy(true)
    setError(null)
    try {
      setCapsule(await action())
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'CAPSULE_FINAL'
          ? 'They have already opened it, so it can no longer change.'
          : 'That didn’t work. Please try again.',
      )
      api.getCapsule(id).then(setCapsule).catch(() => {})
    } finally {
      setBusy(false)
      setConfirmCancel(false)
    }
  }

  return (
    <main className="page detail">
      <header className="topbar">
        <Link to="/history" className="brand">
          Birthday Capsule
        </Link>
        <Link to="/history" className="btn btn-quiet">
          ← Your capsules
        </Link>
      </header>

      <div className="detail-head">
        <div>
          <h1>{c.recipient_name}</h1>
          <p className="muted">{c.city_label}</p>
        </div>
        <StatusBadge status={c.status} />
      </div>
      <p className={c.delivery_trouble ? 'error' : 'detail-when'}>{deliveryLine(c)}</p>

      {c.reply && (
        <section className="detail-reply" aria-label="Their thank-you">
          <p className="small muted">Their thank-you</p>
          <blockquote>“{c.reply.text}”</blockquote>
        </section>
      )}

      <article className="card detail-card">
        {c.message_text && <p className="detail-message">{c.message_text}</p>}
        {c.media.length > 0 && (
          <MediaGallery items={c.media.map((m) => ({ key: m.id, kind: m.kind, url: mediaUrl.own(m.id) }))} />
        )}
        {c.gift_kind && (
          <p className="detail-gift">
            🎁 {c.gift_kind === 'link' ? 'Gift link' : 'Gift code'}
            {c.gift_note && <span className="muted"> · {c.gift_note}</span>}
          </p>
        )}
      </article>

      {error && <p className="error">{error}</p>}

      {editable && (
        <div className="detail-actions">
          <button type="button" className="btn" disabled={busy} onClick={() => navigate(`/capsules/${c.id}/edit`)}>
            Edit
          </button>
          {confirmCancel ? (
            <span className="detail-confirm" role="group" aria-label="Confirm cancel">
              <span>Take it back? {c.status === 'delivered' ? 'Their link will stop working.' : 'It won’t be sent.'}</span>
              <button type="button" className="btn btn-danger" disabled={busy} onClick={() => run(() => api.cancelCapsule(c.id))}>
                Yes, cancel it
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => setConfirmCancel(false)}>
                Keep it
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => setConfirmCancel(true)}>
              Cancel capsule
            </button>
          )}
          {demoMode && c.status === 'scheduled' && (
            <button type="button" className="demo-button" disabled={busy} onClick={() => run(() => api.simulateMidnight(c.id))}>
              <span className="demo-tag">Demo</span> Simulate their midnight
            </button>
          )}
        </div>
      )}
      {c.status === 'opened' && <p className="muted small">Opened capsules are final.</p>}
    </main>
  )
}
