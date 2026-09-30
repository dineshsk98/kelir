import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, ApiError, mediaUrl, type RecipientCapsule as Capsule } from '../api'
import { ReplyPanel } from '../components/ReplyPanel'
import { Reveal, type RevealCapsule } from '../reveal/Reveal'
import './RecipientCapsule.css'

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; capsule: Capsule }
  | { kind: 'not-found' }
  | { kind: 'cancelled' }
  | { kind: 'error' }

const MESSAGES = {
  'not-found': ["We couldn't find this capsule", 'Check that you opened the whole link from your email.'],
  cancelled: ['This capsule is no longer available', 'The person who made it has taken it back.'],
  error: ['Something went wrong', 'Please try opening the link again in a moment.'],
} as const

/** The recipient's private page: the staged opening, then their thank-you. */
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

  const reveal = useMemo<RevealCapsule | null>(() => {
    if (state.kind !== 'ready') return null
    const c = state.capsule
    return {
      senderName: c.sender_name,
      recipientName: c.recipient_name,
      messageText: c.message_text ?? undefined,
      media: c.media.map((m) => ({ key: m.id, kind: m.kind, url: mediaUrl.viaLink(secret, m.id) })),
      gift:
        c.gift_kind && c.gift_value
          ? { kind: c.gift_kind, value: c.gift_value, note: c.gift_note ?? undefined }
          : undefined,
    }
  }, [state, secret])

  if (state.kind === 'loading') return <main className="recipient-empty" aria-busy="true" />
  if (state.kind !== 'ready' || !reveal) {
    const [title, detail] = MESSAGES[state.kind === 'ready' ? 'error' : state.kind]
    return (
      <main className="recipient-empty">
        <div className="card recipient-card">
          <h1>{title}</h1>
          <p className="muted">{detail}</p>
        </div>
      </main>
    )
  }

  const c = state.capsule
  return (
    <main>
      <Reveal
        capsule={reveal}
        replyPanel={
          <ReplyPanel secret={secret} senderName={c.sender_name} presets={c.reply_presets} initialReply={c.reply} />
        }
      />
    </main>
  )
}
