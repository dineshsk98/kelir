import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  api,
  ApiError,
  mediaUrl,
  type CapsuleAccess,
  type CapsuleTarget,
  type RecipientCapsule as Capsule,
} from '../api'
import { ReplyPanel } from '../components/ReplyPanel'
import { SignInChoice } from '../components/SignIn'
import type { RevealCapsule } from '../reveal/Reveal'
import { preloadGiftScene, Reveal3D } from '../reveal3d/Reveal3D'
import { SIGN_IN_COPY } from '../signInCopy'
import './RecipientCapsule.css'

type State =
  | { kind: 'loading' }
  // Not signed in as the recipient: the cake plays, and the sign-in card waits at the candles
  | { kind: 'locked'; access: CapsuleAccess }
  | { kind: 'ready'; capsule: Capsule }
  | { kind: 'not-found' }
  | { kind: 'cancelled' }
  | { kind: 'error' }

const MESSAGES = {
  'not-found': ["We couldn't find this capsule", 'Check that you opened the whole link from your email.'],
  'not-received': ["We couldn't find this capsule", 'It may have been taken back. Your capsules are under Received.'],
  cancelled: ['This capsule is no longer available', 'The person who made it has taken it back.'],
  error: ['Something went wrong', 'Please try opening the link again in a moment.'],
} as const

/** The emailed link, /c/:secret */
export function RecipientCapsule() {
  const { secret = '' } = useParams()
  const target = useMemo(() => ({ link: secret }), [secret])
  return <CapsuleOpening target={target} />
}

/** A capsule opened from Received, /received/:id (signed in as its recipient already) */
export function ReceivedCapsule() {
  const { id = '' } = useParams()
  const target = useMemo(() => ({ received: id }), [id])
  return (
    <>
      <Link to="/received" className="received-back">
        ← Received
      </Link>
      <CapsuleOpening target={target} />
    </>
  )
}

/** The recipient's page: the 3D opening (cake, then gift box), then their thank-you. Only the
 *  recipient sees what's inside: through a link, before that it's the cake with "confirm it's
 *  you" at the candles (prd.md > Proving it's them). */
function CapsuleOpening({ target }: { target: CapsuleTarget }) {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    // Private page: keep it out of search engines even when reached inside the app
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow'
    document.head.appendChild(robots)
    return () => robots.remove()
  }, [])

  /** Who may open it (a link's question); then what's inside, if that's the person looking */
  const load = useCallback(async () => {
    try {
      if ('link' in target) {
        const access = await api.capsuleAccess(target.link)
        if (!access.allowed) return setState({ kind: 'locked', access })
      }
      setState({ kind: 'ready', capsule: await api.openCapsule(target) })
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setState({ kind: 'not-found' })
      else if (e instanceof ApiError && e.status === 410) setState({ kind: 'cancelled' })
      else setState({ kind: 'error' })
    }
  }, [target])

  useEffect(() => {
    preloadGiftScene() // the 3D opening downloads while the capsule loads
    void load()
  }, [load])

  const reveal = useMemo<RevealCapsule | null>(() => {
    if (state.kind === 'locked')
      // Only what the locked link may say: her name and everything inside come after sign-in
      return { senderName: state.access.sender_first_name, recipientName: '', messageLang: state.access.message_lang }
    if (state.kind !== 'ready') return null
    const c = state.capsule
    return {
      senderName: c.sender_name,
      recipientName: c.recipient_name,
      messageText: c.message_text ?? undefined,
      messageLang: c.message_lang,
      media: c.media.map((m) => ({ key: m.id, kind: m.kind, url: mediaUrl.forRecipient(target, m.id) })),
      gift:
        c.gift_kind && c.gift_value
          ? { kind: c.gift_kind, value: c.gift_value, note: c.gift_note ?? undefined }
          : undefined,
    }
  }, [state, target])

  if (state.kind === 'loading') return <main className="recipient-empty" aria-busy="true" />
  if ((state.kind !== 'ready' && state.kind !== 'locked') || !reveal) {
    const kind = state.kind === 'not-found' && 'received' in target ? 'not-received' : state.kind
    const [title, detail] = MESSAGES[kind === 'ready' || kind === 'locked' ? 'error' : kind]
    return (
      <main className="recipient-empty">
        <div className="card recipient-card">
          <h1>{title}</h1>
          <p className="muted">{detail}</p>
        </div>
      </main>
    )
  }

  // One <Reveal3D> for both states, so signing in at the cake carries straight on
  const c = state.kind === 'ready' ? state.capsule : null
  return (
    <main>
      <Reveal3D
        capsule={reveal}
        lockedPanel={
          state.kind === 'locked' ? (
            // Keyed by who's signed in, so a wrong account starts the card afresh
            <ConfirmItsYou key={state.access.signed_in_as ?? ''} access={state.access} onSignedIn={() => void load()} />
          ) : undefined
        }
        // The gift opens once: after that the link shows what was inside (spec.md > Opening once)
        alreadyOpened={c !== null && c.opened_at !== null}
        onFirstReveal={c && c.opened_at === null ? () => void api.markOpened(target).catch(() => {}) : undefined}
        replyPanel={
          c && <ReplyPanel target={target} senderName={c.sender_name} presets={c.reply_presets} initialReply={c.reply} />
        }
      />
    </main>
  )
}

/** At the cake, before the candles: sign in as the email the capsule was sent to */
function ConfirmItsYou({ access, onSignedIn }: { access: CapsuleAccess; onSignedIn: () => void }) {
  const copy = SIGN_IN_COPY[access.message_lang]
  return (
    <section className="r3d-signin" aria-labelledby="confirm-title" lang={access.message_lang}>
      <h2 id="confirm-title">{copy.confirmTitle}</h2>
      <p className="r3d-signin-for">
        {access.signed_in_as
          ? copy.wrongAccount(access.signed_in_as, access.recipient_hint)
          : copy.forEmail(access.recipient_hint)}
      </p>
      <SignInChoice lang={access.message_lang} emailPlaceholder={access.recipient_hint} onSignedIn={onSignedIn} />
    </section>
  )
}
