import { useRef, useState } from 'react'
import type { MediaKind } from '../api'
import './MediaGallery.css'

export type GalleryItem = { key: string; kind: MediaKind; url: string }

/** Shows a capsule's media in order: runs of photos as a swipeable strip, audio and video
 *  as players. Used in the editor's Preview and in the recipient's opening. */
export function MediaGallery({ items }: { items: GalleryItem[] }) {
  // Group consecutive photos so they swipe together; keep audio/video where they were added
  const groups: GalleryItem[][] = []
  for (const item of items) {
    const last = groups.at(-1)
    if (item.kind === 'image' && last?.[0].kind === 'image') last.push(item)
    else groups.push([item])
  }
  return (
    <div className="media-gallery">
      {groups.map((group) =>
        group[0].kind === 'image' ? (
          <PhotoStrip key={group[0].key} photos={group} />
        ) : group[0].kind === 'video' ? (
          <video key={group[0].key} className="gallery-video" src={group[0].url} controls playsInline preload="metadata" />
        ) : (
          <audio key={group[0].key} className="gallery-audio" src={group[0].url} controls preload="metadata" />
        ),
      )}
    </div>
  )
}

function PhotoStrip({ photos }: { photos: GalleryItem[] }) {
  const strip = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  const go = (i: number) => {
    const el = strip.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div className="photo-strip-wrap" aria-roledescription="carousel" aria-label="Photos">
      <div
        ref={strip}
        className="photo-strip"
        onScroll={(e) => {
          const el = e.currentTarget
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
        }}
      >
        {photos.map((p, i) => (
          <img key={p.key} src={p.url} alt={`Photo ${i + 1} of ${photos.length}`} loading="lazy" />
        ))}
      </div>
      {photos.length > 1 && (
        <div className="photo-nav">
          <button type="button" aria-label="Previous photo" disabled={index === 0} onClick={() => go(index - 1)}>
            ‹
          </button>
          <span className="photo-count">
            {index + 1} / {photos.length}
          </span>
          <button
            type="button"
            aria-label="Next photo"
            disabled={index === photos.length - 1}
            onClick={() => go(index + 1)}
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
