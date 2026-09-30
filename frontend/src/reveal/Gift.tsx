import { useState } from 'react'

export type RevealGift = { kind: 'link' | 'code'; value: string; note?: string }

/** The gift: a link as a button, or a code hidden until tapped, with a copy button. */
export function Gift({ gift }: { gift: RevealGift }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(gift.value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setRevealed(true) // no clipboard access: the code stays visible to copy by hand
    }
  }

  return (
    <section className="reveal-gift" aria-label="Your gift">
      {gift.note && <p className="reveal-gift-note">{gift.note}</p>}
      {gift.kind === 'link' ? (
        // noreferrer: the gift site never sees this page's private URL
        <a className="btn" href={gift.value} target="_blank" rel="noopener noreferrer">
          🎁 Open your gift
        </a>
      ) : revealed ? (
        <div className="reveal-code-row">
          <code className="reveal-code">{gift.value}</code>
          <button type="button" className="btn" onClick={copy}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      ) : (
        <button type="button" className="reveal-code-hidden" onClick={() => setRevealed(true)}>
          🎁 Tap to reveal your gift
        </button>
      )}
    </section>
  )
}
