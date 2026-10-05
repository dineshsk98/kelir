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
import { knownLang, useMessageLang } from '../languages'
import { RecipientLangProvider, useRecipientCopy, useRecipientLang } from '../recipientCopy'
import { burstConfetti, themeConfettiColors } from '../reveal/confetti'
import { usePrefersReducedMotion, type RevealCapsule } from '../reveal/Reveal'
import { loadMuted, saveMuted } from '../reveal/sfx'
import { Backdrop, type BackdropPhoto } from './Backdrop'
import { CakePhoto } from './CakePhoto'
import { CapsuleContents } from './CapsuleContents'
import type { Pull } from './GiftScene'
import { GiftSfx } from './sfx3d'
import { after, DURATION, reached, REDUCED_FADE_MS, type Stage } from './stages'
import './Reveal3D.css'

const loadGiftScene = () => import('./GiftScene')
const GiftScene = lazy(loadGiftScene)

/** Start downloading three.js early (e.g. while the capsule itself is loading). */
export const preloadGiftScene = () => void loadGiftScene().catch(() => {})

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

type Reveal3DProps = {
  capsule: RevealCapsule
  replyPanel?: ReactNode
  onFirstReveal?: () => void
  /** Force reduced motion on/off (the dev page); otherwise follows the device setting */
  reducedMotion?: boolean
  backdrop?: BackdropPhoto
  /** Already opened once: start at the open box with its contents, no cake or ribbon */
  alreadyOpened?: boolean
  /** Not signed in as the recipient yet: shown at the cake instead of the candle buttons,
   *  and Skip is hidden, so nothing goes further until she has signed in */
  lockedPanel?: ReactNode
}

/**
 * The 3D opening (design canvas "Capsule Reveal"): the box arrives, she pulls the ribbon,
 * it unties, charges, bursts, and the photocard rises. Same props as the first <Reveal>.
 * Mute, sound, skip and reduced motion live in here. Everything around the sender's own words
 * is in the capsule's language, and so is its handwriting.
 */
export function Reveal3D(props: Reveal3DProps) {
  // The viewers, players, gift and thank-you inside read the language from here
  return (
    <RecipientLangProvider value={knownLang(props.capsule.messageLang)}>
      <Opening {...props} />
    </RecipientLangProvider>
  )
}

function Opening({
  capsule,
  replyPanel,
  onFirstReveal,
  reducedMotion,
  backdrop = 'colour',
  alreadyOpened = false,
  lockedPanel,
}: Reveal3DProps) {
  const prefersReduced = usePrefersReducedMotion()
  const reduced = reducedMotion ?? prefersReduced
  const [stage, setStage] = useState<Stage>(alreadyOpened ? 'explore' : 'cake_arrive')
  const [muted, setMuted] = useState(loadMuted)
  const [webgl, setWebgl] = useState(true)
  const [sceneReady, setSceneReady] = useState(false)
  const onSceneReady = useCallback(() => setSceneReady(true), [])
  const [cakeReady, setCakeReady] = useState(false)
  const onCakeReady = useCallback(() => setCakeReady(true), [])
  const ready = cakeReady && (sceneReady || !webgl)
  const stageRef = useRef<Stage>(stage)
  const rootRef = useRef<HTMLDivElement | null>(null)
  // The same element as state, so the contents (drawn into it) appear even when the page
  // starts at the open box and nothing else re-renders after mounting
  const [overlayRoot, setOverlayRoot] = useState<HTMLDivElement | null>(null)
  const setRoot = useCallback((el: HTMLDivElement | null) => {
    rootRef.current = el
    setOverlayRoot(el)
  }, [])
  const confettiRef = useRef<HTMLCanvasElement>(null)
  const sfx = useRef<GiftSfx | null>(null)
  const stopConfetti = useRef<() => void>(() => {})
  const pull = useRef<Pull>({ amount: 0, dx: 0, dy: 1 })
  const drag = useRef<{ x: number; y: number } | null>(null)
  const touched = useRef(false)
  const tapTimer = useRef<number>()
  const revealedOnce = useRef(false)
  const firstName = capsule.recipientName.split(' ')[0]
  const lang = useRecipientLang()
  const t = useRecipientCopy()
  const langProps = useMessageLang(lang) // the handwriting (titles, letter, record label) follows it

  stageRef.current = stage

  // Signing in can reveal that it was already opened (on another device): straight to the box
  useEffect(() => {
    if (alreadyOpened && !reached(stageRef.current, 'explore')) setStage('explore')
  }, [alreadyOpened])

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

  // Timed stages advance by themselves; reduced motion skips the cake's and the box's arrival.
  useEffect(() => {
    const next = after(stage)
    if (!next) return
    // The cake's entrance waits for the cake photo and the 3D view, which can take seconds
    // to download on a phone
    if (stage === 'cake_arrive' && !ready) return
    const ms = reduced && (stage === 'arrive' || stage === 'cake_arrive') ? 0 : DURATION[stage] ?? 0
    const timer = window.setTimeout(() => setStage(next), ms)
    return () => window.clearTimeout(timer)
  }, [stage, reduced, ready])

  // Sound, confetti and haptics per stage
  useEffect(() => {
    const s = sfx.current
    if (stage === 'charge') s?.charge((DURATION.charge ?? 1300) / 1000)
    if (stage === 'burst') {
      s?.burst()
      navigator.vibrate?.(40) // Android only; iOS ignores it
      if (!reduced && confettiRef.current && rootRef.current) {
        stopConfetti.current()
        // A gentle shower from the box (fewer pieces than the first opening); in landscape
        // the scene sits right of centre (see SIDE in GiftScene.tsx)
        const landscape = window.innerWidth / window.innerHeight > 1.1
        stopConfetti.current = burstConfetti(confettiRef.current, themeConfettiColors(rootRef.current), {
          count: 70,
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
  }, [stage, onFirstReveal, reduced])

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

  const blowCandle = useCallback(() => {
    if (stageRef.current !== 'blow') return
    firstTouch()
    // The candles go out: applause, then Happy Birthday on the piano for the rest of the opening
    sfx.current?.clap()
    sfx.current?.birthdayTune(1.2)
    setStage(reduced ? 'arrive' : 'cake_aside')
  }, [reduced])

  // Blowing for real is her choice: the microphone is only asked for when she taps
  // "Blow for real", and it's released as soon as the candle is out (or she moves on).
  const [listening, setListening] = useState(false)
  const micAvailable = typeof navigator.mediaDevices?.getUserMedia === 'function'

  useEffect(() => {
    if (stage !== 'blow' || !listening) return
    let cancelled = false
    let stream: MediaStream | null = null
    let audio: AudioContext | null = null
    let frame = 0

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        // The answer can arrive after she has already tapped or skipped: let go at once
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream = s
        audio = new AudioContext()
        const analyser = audio.createAnalyser()
        analyser.fftSize = 256
        audio.createMediaStreamSource(s).connect(analyser)
        const bins = new Uint8Array(analyser.frequencyBinCount)
        const listen = () => {
          analyser.getByteFrequencyData(bins)
          // A puff of air is loud in the lowest frequencies
          let low = 0
          for (let i = 0; i < 15; i++) low += bins[i]
          if (low > 2500) blowCandle()
          else frame = requestAnimationFrame(listen)
        }
        listen()
      })
      .catch(() => {
        if (!cancelled) setListening(false) // denied or no microphone: the tap still works
      })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((t) => t.stop())
      void audio?.close().catch(() => {})
    }
  }, [stage, listening, blowCandle])

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
    sfx.current?.birthdayTune() // skipping the candles still gets the song
    setStage('explore')
  }

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    saveMuted(next)
    sfx.current?.setMuted(next) // also fades the song
    if (!next) sfx.current?.unlock()
  }

  // Her voice note or video playing: the birthday tune steps back until it stops
  const onMediaPlaying = useCallback((playing: boolean) => sfx.current?.holdDuck(playing), [])

  const onSceneError = useCallback(() => {
    setWebgl(false)
    setStage('explore')
  }, [])

  const open = reached(stage, 'explore')
  const titleShown = !reached(stage, 'burst') || open

  return (
    <div
      ref={setRoot}
      className={`r3d r3d-at-${stage}${reduced ? ' reduced' : ''}`}
      style={{ ['--reduced-fade' as string]: `${REDUCED_FADE_MS}ms` }}
      {...langProps}
    >
      <section
        className="r3d-stage"
        aria-label={firstName ? t.giftFromTo(firstName, capsule.senderName) : t.giftForYou}
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
                lang={lang}
                onReady={onSceneReady}
              />
            </Suspense>
          </SceneBoundary>
        )}
        <CakePhoto shown={ready && !open} blown={reached(stage, 'cake_aside')} reduced={reduced} onReady={onCakeReady} />
        <canvas ref={confettiRef} className="r3d-confetti" aria-hidden="true" />
        <div className="r3d-flash" aria-hidden="true" />

        <header className={`r3d-title${titleShown ? '' : ' hidden'}`}>
          <h1>{open ? t.happyBirthday(firstName) : firstName ? t.giftFor(firstName) : t.giftForYou}</h1>
          <p>{t.from(capsule.senderName)}</p>
        </header>

        <div className="r3d-controls">
          <button
            type="button"
            className="r3d-icon"
            aria-pressed={muted}
            aria-label={muted ? t.soundOff : t.soundOn}
            title={muted ? t.soundOff : t.soundOn}
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
          {!open && !lockedPanel && (
            <button type="button" className="r3d-pill" onClick={skip}>
              {t.skip}
            </button>
          )}
        </div>

        {open && overlayRoot && (
          <CapsuleContents
            capsule={capsule}
            replyPanel={replyPanel}
            overlayRoot={overlayRoot}
            reduced={reduced}
            onMediaPlaying={onMediaPlaying}
          />
        )}

        <div className="r3d-bottom" aria-live="polite">
          {stage === 'pull' && (
            <button type="button" className="r3d-pull" onClick={pullByTap}>
              {t.pullRibbon}
            </button>
          )}
          {stage === 'blow' && lockedPanel}
          {stage === 'blow' && !lockedPanel && (
            <div className="r3d-blow">
              <button type="button" className="r3d-pull" onClick={blowCandle}>
                {t.blowCandles}
              </button>
              {micAvailable && !listening && (
                <button type="button" className="r3d-pill" onClick={() => setListening(true)}>
                  🎤 {t.blowForReal}
                </button>
              )}
              {listening && <p className="r3d-listening">{t.listening}</p>}
            </div>
          )}
        </div>
      </section>

    </div>
  )
}
