import './Avatar.css'

/** First letters of the first and last words: "Aiko Tanaka" → "AT", "Ben" → "B" */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words.slice(0, 1)
  return letters.map((w) => Array.from(w)[0]).join('').toUpperCase()
}

/** A hue from the seed, so the same person always gets the same colour (the cards use it too) */
export function hue(seed: string): number {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}

/** The picture standing in for a person: a coloured circle with their initials. */
export function Avatar({ name, seed, size = 64 }: { name: string; seed: string; size?: number }) {
  return (
    <span
      className="avatar"
      role="img"
      aria-label={name}
      style={{ '--hue': hue(seed.toLowerCase()), width: size, height: size, fontSize: size * 0.38 } as React.CSSProperties}
    >
      {initials(name) || '🎂'}
    </span>
  )
}
