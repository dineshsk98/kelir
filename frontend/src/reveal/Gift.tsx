import { useState } from 'react'
import { useRecipientCopy } from '../recipientCopy'

export type RevealGift = { kind: 'link' | 'code'; value: string; note?: string }

/** The gift: a link as a button, or a code hidden until tapped, with a copy button. */
export function Gift({ gift }: { gift: RevealGift }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const t = useRecipientCopy() // English outside the 3D opening (the first <Reveal>)

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
    <section className="reveal-gift" aria-label={t.gift}>
      {gift.note && <p className="reveal-gift-note">{gift.note}</p>}
      {gift.kind === 'link' ? (
        // noreferrer: the gift site never sees this page's private URL
        <a className="btn" href={gift.value} target="_blank" rel="noopener noreferrer">
          🎁 {t.openGift}
        </a>
      ) : revealed ? (
        <div className="reveal-code-row">
          <code className="reveal-code">{gift.value}</code>
          <button type="button" className="btn" onClick={copy}>
            {copied ? t.copied : t.copy}
          </button>
        </div>
      ) : (
        <button type="button" className="reveal-code-hidden" onClick={() => setRevealed(true)}>
          🎁 {t.revealGift}
        </button>
      )}
    </section>
  )
}
