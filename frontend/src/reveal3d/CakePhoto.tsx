import { useEffect, useState } from 'react'
import { CAKES, prepareCake, type CakeName, type PreparedCake } from './cakeFlames'

/**
 * The birthday cake: a real photo whose own flames flicker (a soft glow on each), centre
 * stage until she blows. Then it cross-fades to the same photo with the flames painted out,
 * smoke rises from every wick, and the cake glides to the bottom left to make room for the
 * gift. Calls onReady once the blown-out copy is made (or making it failed).
 */
export function CakePhoto({
  name = 'candles',
  shown,
  blown,
  reduced,
  onReady,
}: {
  name?: CakeName
  shown: boolean
  blown: boolean
  reduced: boolean
  onReady: () => void
}) {
  const [cake, setCake] = useState<PreparedCake | null>(null)
  const src = CAKES[name].src

  useEffect(() => {
    let cancelled = false
    let made: PreparedCake | null = null
    prepareCake(src)
      .then((c) => {
        made = c
        if (cancelled) return URL.revokeObjectURL(c.outUrl)
        setCake(c)
      })
      .catch(() => {}) // without the painted copy, blowing out just dims the photo
      .finally(() => !cancelled && onReady())
    return () => {
      cancelled = true
      if (made) URL.revokeObjectURL(made.outUrl)
    }
  }, [src, onReady])

  return (
    <figure
      className={`r3d-cake${shown ? ' shown' : ''}${blown ? ' blown' : ' centre'}${cake ? '' : ' plain'}${reduced ? ' still' : ''}`}
      style={cake ? { aspectRatio: String(cake.aspect) } : undefined}
      aria-hidden="true"
    >
      <img className="r3d-cake-lit" src={src} alt="" draggable={false} />
      {cake && <img className="r3d-cake-out" src={cake.outUrl} alt="" draggable={false} />}
      {cake?.flames.map((f, i) => (
        <span
          key={i}
          className="r3d-cake-flame"
          style={{
            left: `${f.x * 100}%`,
            top: `${f.y * 100}%`,
            // Each flame flickers on its own rhythm
            animationDuration: `${0.9 + ((i * 37) % 7) / 10}s`,
            animationDelay: `${-((i * 53) % 10) / 10}s`,
          }}
        >
          <span className="r3d-cake-smoke" style={{ animationDelay: `${((i * 29) % 6) / 20}s` }} />
        </span>
      ))}
    </figure>
  )
}
