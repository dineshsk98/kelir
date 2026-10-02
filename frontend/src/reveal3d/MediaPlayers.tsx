import { useEffect, useRef, useState, type ReactNode } from 'react'
import './MediaPlayers.css'

type OnPlaying = ((playing: boolean) => void) | undefined

/**
 * Follows a voice note or video element: whether it plays, where it is, how long it is.
 * Reports each start and stop (so the birthday tune can step back while she listens);
 * every start is matched by exactly one stop, including when the viewer closes mid-play.
 */
function useMediaClock<T extends HTMLMediaElement>(onPlaying: OnPlaying) {
  const ref = useRef<T>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(Number.NaN)
  const report = useRef(onPlaying)
  report.current = onPlaying
  const reported = useRef(false)

  const set = (now: boolean) => {
    setPlaying(now)
    if (reported.current === now) return
    reported.current = now
    report.current?.(now)
  }
  useEffect(
    () => () => {
      if (reported.current) report.current?.(false)
      reported.current = false
    },
    [],
  )

  const readDuration = () => setDuration(ref.current?.duration ?? Number.NaN)
  const events = {
    onPlay: () => set(true),
    onPause: () => set(false),
    onEnded: () => set(false),
    onTimeUpdate: () => setTime(ref.current?.currentTime ?? 0),
    onLoadedMetadata: readDuration,
    onDurationChange: readDuration,
  }
  // play() rejects if the browser blocks it; she can press play again
  const play = (blocked?: () => void) => ref.current?.play().catch(() => blocked?.())
  const pause = () => ref.current?.pause()
  const toggle = () => (ref.current?.paused ? play() : pause())
  const seek = (to: number) => {
    if (ref.current) ref.current.currentTime = to
    setTime(to)
  }
  // Recordings without a length in their header report Infinity: no seeking then
  const known = Number.isFinite(duration) && duration > 0
  const progress = known ? Math.min(time / duration, 1) : 0
  return { ref, events, playing, time, duration, known, progress, play, pause, toggle, seek }
}

// Rounded, so a recording of 4.98 s reads 0:05 (and ends there)
const clock = (s: number) => {
  const whole = Math.round(s)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** Play/pause, a position slider (arrow keys seek), the time, and any extra buttons */
function Transport({
  media,
  playing = media.playing,
  onToggle = media.toggle,
  children,
}: {
  media: ReturnType<typeof useMediaClock>
  playing?: boolean
  onToggle?: () => void
  children?: ReactNode
}) {
  const { time, duration, known, seek } = media
  return (
    <div className="mp-transport">
      <button type="button" className="mp-play" aria-label={playing ? 'Pause' : 'Play'} onClick={onToggle}>
        <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
      </button>
      <input
        type="range"
        className="mp-seek"
        aria-label="Position"
        min={0}
        max={known ? duration : 1}
        step={0.1}
        value={known ? time : 0}
        disabled={!known}
        aria-valuetext={known ? `${clock(time)} of ${clock(duration)}` : clock(time)}
        onChange={(e) => seek(Number(e.target.value))}
      />
      <span className="mp-time">
        {clock(time)}
        {known && ` / ${clock(duration)}`}
      </span>
      {children}
    </div>
  )
}

// The tonearm turns around its pivot: parked at 0°, the needle meets the record's outer
// groove at 29° and its label edge at 49° (angles worked out for the drawing below)
const ARM_PARKED = 0
const ARM_OUTER = 29
const ARM_INNER = 49
const ARM_SWING_MS = 900

/**
 * A voice note on a record player, seen from above at an angle. Play swings the needle onto
 * the record and the sound starts as it lands; the needle creeps inward as the note plays;
 * pause lifts it back to its rest. Tapping the arm or the record does the same.
 */
export function RecordPlayer({
  src,
  from,
  reduced,
  onPlaying,
}: {
  src: string
  from?: string
  reduced?: boolean
  onPlaying?: OnPlaying
}) {
  const media = useMediaClock<HTMLAudioElement>(onPlaying)
  const [armDown, setArmDown] = useState(false)
  const landing = useRef<number>()

  const lift = () => {
    window.clearTimeout(landing.current)
    media.pause()
    setArmDown(false)
  }
  const drop = () => {
    // A finished note starts again from the outer groove (not swinging to the label first)
    if (media.ref.current?.ended) media.seek(0)
    setArmDown(true)
    window.clearTimeout(landing.current)
    landing.current = window.setTimeout(() => media.play(() => setArmDown(false)), reduced ? 0 : ARM_SWING_MS)
  }
  const toggle = () => (armDown ? lift() : drop())

  // Opening the note puts the needle down by itself, as the other items open straight away
  useEffect(() => {
    drop()
    return () => window.clearTimeout(landing.current)
  }, [])

  const arm = armDown ? ARM_OUTER + (ARM_INNER - ARM_OUTER) * media.progress : ARM_PARKED
  return (
    <div className={`mp-player mp-turntable${media.playing ? ' mp-playing' : ''}`}>
      <div className="mp-deck-tilt">
        <svg viewBox="0 0 400 300" className="mp-art" aria-hidden="true">
          <defs>
            <linearGradient id="mp-wood" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7a4e2d" />
              <stop offset="1" stopColor="#4a2e1a" />
            </linearGradient>
            <radialGradient id="mp-label" r="0.6">
              <stop offset="0" stopColor="#f6d58b" />
              <stop offset="1" stopColor="#e2a84f" />
            </radialGradient>
          </defs>
          <rect x="6" y="6" width="388" height="288" rx="16" fill="url(#mp-wood)" />
          <rect x="18" y="18" width="364" height="264" rx="10" className="mp-plate" />
          <circle cx="160" cy="150" r="120" className="mp-platter" />

          <g className="mp-record" onClick={toggle}>
            <circle cx="160" cy="150" r="112" className="mp-vinyl" />
            {[104, 96, 88, 80, 72, 64, 56].map((r) => (
              <circle key={r} cx="160" cy="150" r={r} className="mp-groove" />
            ))}
            <circle cx="160" cy="150" r="40" fill="url(#mp-label)" />
            <text x="160" y="143" textAnchor="middle" className="mp-label-from">
              {from ?? 'For you'}
            </text>
            <text x="160" y="161" textAnchor="middle" className="mp-label-what">
              voice note
            </text>
          </g>
          {/* Light catching the grooves stays put while the record turns underneath */}
          <path d="M160 150 L 90 52 A 120 120 0 0 1 128 40 Z" className="mp-sheen" />
          <path d="M160 150 L 230 248 A 120 120 0 0 1 192 260 Z" className="mp-sheen" />
          <circle cx="160" cy="150" r="3.5" className="mp-spindle" />

          <circle cx="330" cy="232" r="9" className="mp-rest" />
          <g
            className="mp-arm"
            style={{ transform: `rotate(${arm}deg)` }}
            onClick={toggle}
          >
            <line x1="330" y1="60" x2="330" y2="230" className="mp-arm-hit" />
            <line x1="330" y1="32" x2="330" y2="214" className="mp-arm-rod" />
            <rect x="321" y="212" width="18" height="26" rx="3" className="mp-headshell" />
            <circle cx="330" cy="30" r="13" className="mp-counterweight" />
          </g>
          <circle cx="330" cy="60" r="16" className="mp-pivot" />
          <circle cx="330" cy="60" r="6" className="mp-pivot-cap" />

          <circle cx="44" cy="262" r="5" className="mp-led" />
        </svg>
      </div>
      <audio
        ref={media.ref}
        src={src}
        preload="metadata"
        {...media.events}
        onEnded={() => {
          media.events.onEnded()
          setArmDown(false)
        }}
      />
      <Transport media={media} playing={armDown} onToggle={toggle} />
    </div>
  )
}

const fullscreen = (video: HTMLVideoElement | null) => {
  if (!video) return
  const v = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void }
  if (v.requestFullscreen) v.requestFullscreen().catch(() => {})
  else v.webkitEnterFullscreen?.() // iPhone Safari
}

/** A video projected onto the wall by a small projector, its light fanning up to the picture */
export function ProjectorPlayer({ src, from, onPlaying }: { src: string; from?: string; onPlaying?: OnPlaying }) {
  const media = useMediaClock<HTMLVideoElement>(onPlaying)
  // The beam fans out to the picture's width, which depends on the video's shape
  const [pictureW, setPictureW] = useState<number>()
  useEffect(() => {
    const video = media.ref.current
    if (!video) return
    const watch = new ResizeObserver(() => setPictureW(video.offsetWidth))
    watch.observe(video)
    return () => watch.disconnect()
  }, [media.ref])
  return (
    <div
      className={`mp-player mp-cinema${media.playing ? ' mp-playing' : ''}`}
      style={pictureW ? { ['--picture-w' as string]: `${pictureW}px` } : undefined}
    >
      <div className="mp-projection">
        {/* Tapping the picture plays or pauses it; the button below does the same by keyboard */}
        <video ref={media.ref} src={src} autoPlay playsInline preload="metadata" onClick={media.toggle} {...media.events} />
        <div className="mp-projection-bar">
          <span className="mp-projection-title">{from ? `A video from ${from}` : 'A video'}</span>
          <Transport media={media}>
            <button
              type="button"
              className="mp-fullscreen"
              aria-label="Full screen"
              onClick={() => fullscreen(media.ref.current)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
              </svg>
            </button>
          </Transport>
        </div>
      </div>
      <div className="mp-beam" aria-hidden="true" />
      <svg viewBox="0 0 120 110" className="mp-projector" aria-hidden="true">
        <defs>
          <linearGradient id="mp-can" x1="0" x2="1">
            <stop offset="0" stopColor="#15161c" />
            <stop offset="0.45" stopColor="#3b3e48" />
            <stop offset="1" stopColor="#121318" />
          </linearGradient>
          <radialGradient id="mp-glass">
            <stop offset="0" stopColor="#f2f7ff" />
            <stop offset="0.5" stopColor="#9fc2ff" />
            <stop offset="1" stopColor="#2a3550" />
          </radialGradient>
        </defs>
        <rect x="12" y="14" width="96" height="100" fill="url(#mp-can)" />
        <ellipse cx="60" cy="14" rx="48" ry="11" className="mp-can-top" />
        <ellipse cx="60" cy="14" rx="20" ry="5" fill="url(#mp-glass)" className="mp-lens-glow" />
        <rect x="34" y="44" width="52" height="15" rx="7.5" className="mp-panel" />
        {[44, 54, 66, 76].map((x) => (
          <circle key={x} cx={x} cy="51.5" r="2" className="mp-panel-dot" />
        ))}
      </svg>
    </div>
  )
}
