import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { MediaGallery } from '../components/MediaGallery'
import { burstConfetti, themeConfettiColors } from '../reveal/confetti'
import { Gift } from '../reveal/Gift'
import { usePrefersReducedMotion, type RevealCapsule } from '../reveal/Reveal'
import { loadMuted, saveMuted } from '../reveal/sfx'
import { Backdrop, type BackdropPhoto } from './Backdrop'
import type { Pull } from './GiftScene'
import { GiftSfx } from './sfx3d'
import { after, DURATION, reached, REDUCED_FADE_MS, type Stage } from './stages'
import './Reveal3D.css'

const GiftScene = lazy(() => import('./GiftScene'))

/** If WebGL is missing or the scene crashes, the page carries on without the 3D box. */
class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/** How far a drag (in any direction) must travel to pull the ribbon loose: a share of the short side. */
const PULL_SPAN = 0.28

/**
 * The 3D opening (design canvas "Capsule Reveal"): the box arrives, she pulls the ribbon,
 * it unties, charges, bursts, and the photocard rises. Same props as the first <Reveal>.
 * Mute, sound, skip and reduced motion live in here.
 */
export function Reveal3D({
  capsule,
  replyPanel,
  onFirstReveal,
  reducedMotion,
  backdrop = 'colour',
}: {
  capsule: RevealCapsule
  replyPanel?: ReactNode
  onFirstReveal?: () => void
  /** Force reduced motion on/off (the dev page); otherwise follows the device setting */
  reducedMotion?: boolean
  backdrop?: BackdropPhoto
}) {
  const prefersReduced = usePrefersReducedMotion()
  const reduced = reducedMotion ?? prefersReduced
  const [stage, setStage] = useState<Stage>('arrive')
  const [muted, setMuted] = useState(loadMuted)
  const [webgl, setWebgl] = useState(true)
  const stageRef = useRef<Stage>('arrive')
  const rootRef = useRef<HTMLDivElement>(null)
  const confettiRef = useRef<HTMLCanvasElement>(null)
  const sfx = useRef<GiftSfx | null>(null)
  const stopConfetti = useRef<() => void>(() => {})
  const pull = useRef<Pull>({ amount: 0, dx: 0, dy: 1 })
  const drag = useRef<{ x: number; y: number } | null>(null)
  const touched = useRef(false)
  const tapTimer = useRef<number>()
  const revealedOnce = useRef(false)
  const firstName = capsule.recipientName.split(' ')[0]

  stageRef.current = stage

  // Created in an effect (not during render) so React's dev double-mount gets a fresh one
  useEffect(() => {
    sfx.current = new GiftSfx(loadMuted())
    return () => {
      window.clearTimeout(tapTimer.current)
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
    const timer = window.setTimeout(() => setStage(next), ms)
    return () => window.clearTimeout(timer)
  }, [stage, reduced])

  // Sound, confetti and haptics per stage
  useEffect(() => {
    const s = sfx.current
    if (stage === 'charge') s?.charge((DURATION.charge ?? 1300) / 1000)
    if (stage === 'burst') {
      s?.burst()
      navigator.vibrate?.(40) // Android only; iOS ignores it
      if (confettiRef.current && rootRef.current) {
        stopConfetti.current()
        // From the box: in landscape the scene sits right of centre (see SIDE in GiftScene.tsx)
        const landscape = window.innerWidth / window.innerHeight > 1.1
        stopConfetti.current = burstConfetti(confettiRef.current, themeConfettiColors(rootRef.current), {
          originX: landscape ? 0.67 : 0.5,
          originY: 0.5,
        })
      }
    }
    if (stage === 'rise') s?.swell()
    if (reached(stage, 'rise') && !revealedOnce.current) {
      revealedOnce.current = true
      onFirstReveal?.()
    }
  }, [stage, onFirstReveal])

  /** Her first touch: unlock audio (browsers only allow it inside a gesture) and ring the bell */
  const firstTouch = () => {
    if (touched.current) return
    touched.current = true
    sfx.current?.unlock()
    sfx.current?.touch()
  }

  const untie = useCallback(() => {
    if (stageRef.current !== 'pull') return
    sfx.current?.zip()
    setStage(reduced ? 'explore' : 'untie')
  }, [reduced])

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (stage !== 'pull' || (e.target as Element).closest('button, a')) return
    firstTouch()
    drag.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
    sfx.current?.stretchStart()
  }

  const release = (done: boolean) => {
    drag.current = null
    sfx.current?.stretchStop()
    if (done) untie()
    else pull.current.amount = 0 // springs back in the scene
  }

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (!drag.current || stage !== 'pull') return
    const x = e.clientX - drag.current.x
    const y = e.clientY - drag.current.y
    const length = Math.hypot(x, y)
    const span = PULL_SPAN * Math.min(window.innerWidth, window.innerHeight)
    const p = Math.min(1, length / span)
    pull.current = length > 0 ? { amount: p, dx: x / length, dy: y / length } : { ...pull.current, amount: 0 }
    sfx.current?.stretch(p)
    if (p >= 1) release(true)
  }

  const onPointerUp = () => {
    if (drag.current) release(false)
  }

  /** The button does the same pull for anyone who can't or won't drag */
  const pullByTap = () => {
    if (stage !== 'pull') return
    firstTouch()
    pull.current = { amount: 1, dx: 0, dy: 1 }
    tapTimer.current = window.setTimeout(untie, 300)
  }

  const skip = () => {
    sfx.current?.unlock()
    setStage('explore')
  }

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    saveMuted(next)
    if (sfx.current) sfx.current.muted = next
    if (!next) sfx.current?.unlock()
  }

  const onSceneError = useCallback(() => {
    setWebgl(false)
    setStage('explore')
  }, [])

  const open = reached(stage, 'explore')
  const titleShown = !reached(stage, 'burst') || open

  return (
    <div
      ref={rootRef}
      className={`r3d r3d-at-${stage}${reduced ? ' reduced' : ''}`}
      style={{ ['--reduced-fade' as string]: `${REDUCED_FADE_MS}ms` }}
    >
      <section
        className="r3d-stage"
        aria-label={`A gift for ${firstName} from ${capsule.senderName}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <Backdrop photo={backdrop} />
        {webgl && (
          <SceneBoundary onError={onSceneError}>
            <Suspense fallback={null}>
              <GiftScene
                stage={stage}
                pull={pull}
                reduced={reduced}
                recipientFirstName={firstName}
                senderName={capsule.senderName}
              />
            </Suspense>
          </SceneBoundary>
        )}
        <canvas ref={confettiRef} className="r3d-confetti" aria-hidden="true" />
        <div className="r3d-flash" aria-hidden="true" />

        <header className={`r3d-title${titleShown ? '' : ' hidden'}`}>
          <h1>{open ? `Happy birthday, ${firstName}` : `A gift for ${firstName}`}</h1>
          <p>from {capsule.senderName}</p>
        </header>

        <div className="r3d-controls">
          <button
            type="button"
            className="r3d-icon"
            aria-pressed={muted}
            aria-label={muted ? 'Sound off' : 'Sound on'}
            title={muted ? 'Sound off' : 'Sound on'}
            onClick={toggleMute}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                 strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H3v6h3l5 4V5z" />
              {muted ? (
                <path d="m16 9 6 6m0-6-6 6" />
              ) : (
                <>
                  <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                  <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                </>
              )}
            </svg>
          </button>
          {!open && (
            <button type="button" className="r3d-pill" onClick={skip}>
              Skip
            </button>
          )}
        </div>

        <div className="r3d-bottom" aria-live="polite">
          {stage === 'pull' && (
            <button type="button" className="r3d-pull" onClick={pullByTap}>
              Pull the ribbon
            </button>
          )}
          {open && (capsule.messageText || capsule.media?.length || capsule.gift) && (
            <p className="r3d-scroll-hint">Scroll for everything {capsule.senderName} sent</p>
          )}
        </div>
      </section>

      {open && (
        <section className="r3d-more">
          {/* The first opening's content, until the next slices put each item in the box */}
          {capsule.messageText && <p className="r3d-letter">{capsule.messageText}</p>}
          {capsule.media && capsule.media.length > 0 && <MediaGallery items={capsule.media} />}
          {capsule.gift && <Gift gift={capsule.gift} />}
          {replyPanel}
        </section>
      )}
    </div>
  )
}
