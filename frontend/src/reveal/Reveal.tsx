import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { MediaGallery, type GalleryItem } from '../components/MediaGallery'
import { useMessageLang } from '../languages'
import { CapsuleArt } from './CapsuleArt'
import { burstConfetti, themeConfettiColors } from './confetti'
import { Gift, type RevealGift } from './Gift'
import { loadMuted, saveMuted, Sfx } from './sfx'
import { after, DURATION, reached, REDUCED_FADE_MS, type Stage } from './stages'
import './Reveal.css'

export type RevealCapsule = {
  senderName: string
  recipientName: string
  messageText?: string
  /** The message's language (sets its handwriting); English if missing */
  messageLang?: string
  /** Photos, audio and video in the order the sender added them */
  media?: GalleryItem[]
  gift?: RevealGift
}

export function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => window.matchMedia?.(query).matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/**
 * The staged opening (spec.md > The contract between the tracks):
 * arrive → ready (tap) → charge → burst → reveal → message → gift, then the reply panel.
 * Mute, sound, skip, reduced motion and replay all live in here.
 */
export function Reveal({
  capsule,
  replyPanel,
  onFirstReveal,
  reducedMotion,
}: {
  capsule: RevealCapsule
  replyPanel?: ReactNode
  onFirstReveal?: () => void
  /** Force reduced motion on/off (the dev page); otherwise follows the device setting */
  reducedMotion?: boolean
}) {
  const prefersReduced = usePrefersReducedMotion()
  const reduced = reducedMotion ?? prefersReduced
  const [stage, setStage] = useState<Stage>('arrive')
  const [muted, setMuted] = useState(loadMuted)
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sfx = useRef<Sfx | null>(null)
  const stopConfetti = useRef<() => void>(() => {})
  const revealedOnce = useRef(false)
  const firstName = capsule.recipientName.split(' ')[0]
  const messageLang = useMessageLang(capsule.messageLang)

  // Created in an effect (not during render) so React's dev double-mount gets a fresh one
  useEffect(() => {
    sfx.current = new Sfx(loadMuted())
    return () => {
      stopConfetti.current()
      sfx.current?.close()
      sfx.current = null
    }
  }, [])

  // Timed stages advance by themselves; reduced motion skips the arrival drop.
  useEffect(() => {
    const next = after(stage)
    if (!next) return
    const ms = reduced && stage === 'arrive' ? 0 : DURATION[stage] ?? 0
    const timer = setTimeout(() => setStage(next), ms)
    return () => clearTimeout(timer)
  }, [stage, reduced])

  // Sound and confetti for each stage (effects, so per-frame work never touches React state)
  useEffect(() => {
    const s = sfx.current
    if (stage === 'charge') s?.charge((DURATION.charge ?? 1400) / 1000)
    if (stage === 'burst') {
      s?.burst()
      if (!reduced && canvasRef.current && rootRef.current) {
        stopConfetti.current()
        stopConfetti.current = burstConfetti(canvasRef.current, themeConfettiColors(rootRef.current))
      }
    }
    if (stage === 'reveal') s?.chime()
    if (reached(stage, 'reveal') && !revealedOnce.current) {
      revealedOnce.current = true
      onFirstReveal?.()
    }
  }, [stage, reduced, onFirstReveal])

  const open = () => {
    if (stage !== 'ready') return
    sfx.current?.unlock() // audio is only allowed inside a user gesture
    sfx.current?.tap()
    setStage(reduced ? 'gift' : 'charge')
  }

  const skip = useCallback(() => {
    sfx.current?.unlock()
    setStage('gift')
  }, [])

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    saveMuted(next)
    if (sfx.current) sfx.current.muted = next
    if (!next) sfx.current?.unlock()
  }

  const closed = !reached(stage, 'reveal')

  return (
    <div
      ref={rootRef}
      className={`reveal stage-${stage}${reduced ? ' reduced' : ''}`}
      style={{ ['--reduced-fade' as string]: `${REDUCED_FADE_MS}ms` }}
    >
      <canvas ref={canvasRef} className="reveal-confetti" aria-hidden="true" />
      <div className="reveal-dim" aria-hidden="true" />
      <div className="reveal-flash" aria-hidden="true" />

      <div className="reveal-controls">
        <button
          type="button"
          className="reveal-icon-button"
          aria-pressed={muted}
          aria-label={muted ? 'Sound off' : 'Sound on'}
          title={muted ? 'Sound off' : 'Sound on'}
          onClick={toggleMute}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        {closed && (
          <button type="button" className="reveal-skip" onClick={skip}>
            Skip
          </button>
        )}
      </div>

      {closed ? (
        <div className="reveal-stage">
          <button
            type="button"
            className="reveal-capsule"
            onClick={open}
            disabled={stage !== 'ready'}
            aria-label={`Open your capsule from ${capsule.senderName}`}
          >
            <span className="reveal-glow" aria-hidden="true" />
            <span className="reveal-rings" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <CapsuleArt />
          </button>
          <p className="reveal-from">
            From <strong>{capsule.senderName}</strong>
          </p>
          <p className="reveal-hint" aria-live="polite">
            {stage === 'ready' ? 'Tap to open' : ' '}
          </p>
        </div>
      ) : (
        <div className="reveal-open">
          <article className="reveal-card">
            <p className="reveal-card-from">{capsule.senderName}</p>
            <h1 className="reveal-card-title">Happy birthday, {firstName}</h1>
            {reached(stage, 'message') && capsule.messageText && (
              <p className="reveal-message" {...messageLang}>
                {capsule.messageText}
              </p>
            )}
            {reached(stage, 'message') && capsule.media && capsule.media.length > 0 && (
              <div className="reveal-media">
                <MediaGallery items={capsule.media} />
              </div>
            )}
            {reached(stage, 'gift') && capsule.gift && <Gift gift={capsule.gift} />}
          </article>
          {reached(stage, 'gift') && replyPanel && <div className="reveal-reply">{replyPanel}</div>}
        </div>
      )}
    </div>
  )
}
