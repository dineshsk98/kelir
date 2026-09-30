import { useState } from 'react'
import { api, ApiError, type Reply, type ReplyPreset } from '../api'
import './ReplyPanel.css'

const MAX = 500

/** The recipient's thank-you: pick a preset or write your own, once (prd.md > Thank-you reply).
 *  This is the `replyPanel` the staged <Reveal> shows last (spec.md > The contract between the tracks). */
export function ReplyPanel({
  secret,
  senderName,
  presets,
  initialReply,
}: {
  secret: string
  senderName: string
  presets: ReplyPreset[]
  initialReply: Reply | null
}) {
  const [reply, setReply] = useState<Reply | null>(initialReply)
  const [preset, setPreset] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const senderFirst = senderName.split(' ')[0]

  if (reply) {
    return (
      <section className="reply-panel reply-sent" aria-live="polite">
        <p className="reply-sent-title">Your thank-you was sent.</p>
        <blockquote className="reply-quote">{reply.text}</blockquote>
      </section>
    )
  }

  const own = text.trim()
  const canSend = !sending && (preset !== null || own.length > 0)

  const send = async () => {
    setSending(true)
    setError(null)
    try {
      setReply(await api.sendReply(secret, preset ? { preset_key: preset } : { text: own }))
    } catch (e) {
      if (e instanceof ApiError && e.code === 'REPLY_EXISTS') {
        // Sent from another tab or a double tap: reload to show what was sent
        const fresh = await api.openCapsule(secret).catch(() => null)
        setReply(fresh?.reply ?? { text: 'Your thank-you was already sent.', created_at: '' })
      } else {
        setError("We couldn't send that. Please try again.")
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="reply-panel" aria-labelledby="reply-title">
      <h2 id="reply-title">Say thank you to {senderFirst}</h2>
      <div className="reply-presets" role="radiogroup" aria-label="Pick a thank-you">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            role="radio"
            aria-checked={preset === p.key}
            className={preset === p.key ? 'reply-preset chosen' : 'reply-preset'}
            onClick={() => {
              setPreset(preset === p.key ? null : p.key)
              setText('')
            }}
          >
            {p.text}
          </button>
        ))}
      </div>
      <label className="reply-own">
        <span className="small muted">Or in your own words</span>
        <textarea
          className="input"
          rows={3}
          maxLength={MAX}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (e.target.value.trim()) setPreset(null)
          }}
        />
        <span className="small muted reply-count">
          {text.length}/{MAX}
        </span>
      </label>
      {error && <p className="error">{error}</p>}
      <button type="button" className="btn" disabled={!canSend} onClick={send}>
        {sending ? 'Sending…' : 'Send thank-you'}
      </button>
    </section>
  )
}
