import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { GalleryItem } from '../components/MediaGallery'
import { Gift } from '../reveal/Gift'
import type { RevealCapsule } from '../reveal/Reveal'
import { ProjectorPlayer, RecordPlayer } from './MediaPlayers'

/** One thing in the capsule she can open */
type Item =
  | { kind: 'message'; key: string; text: string }
  | { kind: 'media'; key: string; media: GalleryItem }
  | { kind: 'gift'; key: string; gift: NonNullable<RevealCapsule['gift']> }

function itemsOf(capsule: RevealCapsule): Item[] {
  const items: Item[] = []
  if (capsule.messageText) items.push({ kind: 'message', key: 'message', text: capsule.messageText })
  for (const m of capsule.media ?? []) items.push({ kind: 'media', key: m.key, media: m })
  if (capsule.gift) items.push({ kind: 'gift', key: 'gift', gift: capsule.gift })
  return items
}

const COUNT_WORDS = ['', 'a little surprise', 'two little surprises', 'three little surprises', 'four little surprises',
  'five little surprises', 'six little surprises', 'seven little surprises', 'eight little surprises']

const label = (item: Item) =>
  item.kind === 'message' ? 'Your letter'
    : item.kind === 'gift' ? 'Your gift'
      : item.media.kind === 'image' ? 'A photo'
        : item.media.kind === 'video' ? 'A video'
          : 'A voice note'

/**
 * What she finds once the box is open: a short note from the sender with a thumbnail for
 * everything inside. Nothing opens by itself; each thumbnail opens in a viewer she can close,
 * and the thank-you has its own button.
 */
export function CapsuleContents({
  capsule,
  replyPanel,
  overlayRoot,
  reduced,
  onMediaPlaying,
}: {
  capsule: RevealCapsule
  replyPanel?: ReactNode
  /** Reduced motion: the record player's needle drops without waiting for its swing */
  reduced?: boolean
  /** A voice note or video started (true) or stopped (false) playing */
  onMediaPlaying?: (playing: boolean) => void
  /** Where viewers are drawn. Not inside this note: its frosted-glass backdrop-filter would
   *  make it the box a full-screen (position: fixed) viewer is measured against. */
  overlayRoot: HTMLElement
}) {
  const items = itemsOf(capsule)
  const [open, setOpen] = useState<number | null>(null)
  const [thanking, setThanking] = useState(false)
  const sender = capsule.senderName.split(' ')[0]
  const count = COUNT_WORDS[items.length] ?? `${items.length} little surprises`

  return (
    <section className="r3d-contents" aria-label={`What ${sender} sent you`}>
      <p className="r3d-contents-kicker">A capsule from {capsule.senderName}</p>
      <h2 className="r3d-contents-title">
        {sender} wrapped up {count} for you
      </h2>
      <p className="r3d-contents-hint">Tap one to open it</p>

      <ul className="r3d-thumbs">
        {items.map((item, i) => (
          <li key={item.key}>
            <button type="button" className={`r3d-thumb r3d-thumb-${thumbKind(item)}`} onClick={() => setOpen(i)}>
              <Thumb item={item} />
              <span className="r3d-thumb-label">{label(item)}</span>
            </button>
          </li>
        ))}
      </ul>

      {replyPanel && (
        <button type="button" className="r3d-pull r3d-thanks" onClick={() => setThanking(true)}>
          💌 Say thank you to {sender}
        </button>
      )}

      {createPortal(
        <>
          {open !== null && (
            <Viewer
              title={label(items[open])}
              room={isPlayable(items[open])}
              onClose={() => setOpen(null)}
              onPrev={open > 0 ? () => setOpen(open - 1) : undefined}
              onNext={open < items.length - 1 ? () => setOpen(open + 1) : undefined}
            >
              <Opened
                key={items[open].key}
                item={items[open]}
                from={sender}
                reduced={reduced}
                onPlaying={onMediaPlaying}
              />
            </Viewer>
          )}
          {/* Always mounted, only hidden: the panel remembers that her thank-you was sent */}
          {replyPanel && (
            <Viewer title={`Thank ${sender}`} hidden={!thanking} onClose={() => setThanking(false)}>
              {replyPanel}
            </Viewer>
          )}
        </>,
        overlayRoot,
      )}
    </section>
  )
}

const thumbKind = (item: Item) => (item.kind === 'media' ? item.media.kind : item.kind)

/** Voice notes and videos play in the scene itself rather than in a box */
const isPlayable = (item: Item) => item.kind === 'media' && item.media.kind !== 'image'

function Thumb({ item }: { item: Item }) {
  if (item.kind === 'message') return <span className="r3d-thumb-letter">{item.text}</span>
  if (item.kind === 'gift') return <span className="r3d-thumb-icon" aria-hidden="true">🎁</span>
  const m = item.media
  if (m.kind === 'image') return <img src={m.url} alt="" loading="lazy" />
  if (m.kind === 'video')
    return (
      <>
        {/* The first frame as the thumbnail ("#t=0.1" makes browsers paint it) */}
        <video src={`${m.url}#t=0.1`} muted playsInline preload="metadata" aria-hidden="true" />
        <span className="r3d-thumb-play" aria-hidden="true">▶</span>
      </>
    )
  return <span className="r3d-thumb-icon" aria-hidden="true">🎙️</span>
}

function Opened({
  item,
  from,
  reduced,
  onPlaying,
}: {
  item: Item
  from: string
  reduced?: boolean
  onPlaying?: (playing: boolean) => void
}) {
  if (item.kind === 'message') return <p className="r3d-letter">{item.text}</p>
  if (item.kind === 'gift') return <Gift gift={item.gift} />
  const m = item.media
  if (m.kind === 'image') return <img className="r3d-viewer-photo" src={m.url} alt="A photo from the capsule" />
  if (m.kind === 'video') return <ProjectorPlayer src={m.url} from={from} onPlaying={onPlaying} />
  return <RecordPlayer src={m.url} from={from} reduced={reduced} onPlaying={onPlaying} />
}

/** A closable overlay: × button, Esc, or a tap outside. Focus moves in and comes back. */
function Viewer({
  title,
  hidden = false,
  room = false,
  onClose,
  onPrev,
  onNext,
  children,
}: {
  title: string
  hidden?: boolean
  /** No box: the scene stays visible behind, dimmed as if the lights went down */
  room?: boolean
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  children: ReactNode
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  // The latest handlers, so the effect below runs only when the viewer opens or closes
  const handlers = useRef({ onClose, onPrev, onNext })
  handlers.current = { onClose, onPrev, onNext }

  useEffect(() => {
    if (hidden) return
    const before = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handlers.current.onClose()
      // Arrow keys on a slider (a player's position) move the slider, not to another item
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowLeft') handlers.current.onPrev?.()
      if (e.key === 'ArrowRight') handlers.current.onNext?.()
    }
    window.addEventListener('keydown', keys)
    return () => {
      window.removeEventListener('keydown', keys)
      before?.focus?.()
    }
  }, [hidden])

  return (
    <div
      className={`r3d-viewer${room ? ' r3d-room' : ''}`}
      hidden={hidden}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="r3d-viewer-box">
        <header className="r3d-viewer-head">
          <span>{title}</span>
          <button ref={closeRef} type="button" className="r3d-icon" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="r3d-viewer-body">{children}</div>
        {(onPrev || onNext) && (
          <nav className="r3d-viewer-nav">
            <button type="button" className="r3d-pill" disabled={!onPrev} onClick={onPrev}>
              ‹ Previous
            </button>
            <button type="button" className="r3d-pill" disabled={!onNext} onClick={onNext}>
              Next ›
            </button>
          </nav>
        )}
      </div>
    </div>
  )
}
