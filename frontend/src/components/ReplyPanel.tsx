import { useState } from 'react'
import { api, ApiError, type Reply, type ReplyPreset } from '../api'
import { MESSAGE_LANGS, useMessageLang, type MessageLang } from '../languages'
import { useRecipientCopy, useRecipientLang } from '../recipientCopy'
import './ReplyPanel.css'

const MAX = 500

/** The recipient's thank-you: pick a preset or write your own, once (prd.md > Thank-you reply).
 *  This is the `replyPanel` the staged <Reveal> shows last (spec.md > The contract between the tracks).
 *  Its words are in the capsule's language; the thank-you itself starts in that language too,
 *  and she can pick another one. */
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
  const t = useRecipientCopy()
  const capsuleLang = useRecipientLang()
  const [lang, setLang] = useState<MessageLang>(capsuleLang)
  // The thank-you's own handwriting and lang (it can differ from the page's)
  const replyLang = useMessageLang(reply?.lang ?? lang)

  if (reply) {
    return (
      <section className="reply-panel reply-sent" aria-live="polite">
        <p className="reply-sent-title">{t.sent}</p>
        <blockquote className="reply-quote" {...replyLang}>
          {reply.text}
        </blockquote>
      </section>
    )
  }

  const own = text.trim()
  const canSend = !sending && (preset !== null || own.length > 0)

  const send = async () => {
    setSending(true)
    setError(null)
    try {
      setReply(await api.sendReply(secret, preset ? { preset_key: preset, lang } : { text: own, lang }))
    } catch (e) {
      if (e instanceof ApiError && e.code === 'REPLY_EXISTS') {
        // Sent from another tab or a double tap: reload to show what was sent
        const fresh = await api.openCapsule(secret).catch(() => null)
        setReply(fresh?.reply ?? { text: t.alreadySent, lang: capsuleLang, created_at: '' })
      } else {
        setError(t.sendFailed)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="reply-panel" aria-labelledby="reply-title">
      <h2 id="reply-title">{t.sayThanks(senderFirst)}</h2>
      <label className="reply-lang">
        <span className="small muted">{t.replyLang}</span>
        <select className="input" value={lang} onChange={(e) => setLang(e.target.value as MessageLang)}>
          {MESSAGE_LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <div className="reply-presets" role="radiogroup" aria-label={t.pickThanks}>
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            role="radio"
            aria-checked={preset === p.key}
            className={preset === p.key ? 'reply-preset chosen' : 'reply-preset'}
            lang={replyLang.lang}
            onClick={() => {
              setPreset(preset === p.key ? null : p.key)
              setText('')
            }}
          >
            {p.texts[lang]}
          </button>
        ))}
      </div>
      <label className="reply-own">
        <span className="small muted">{t.ownWords}</span>
        <textarea
          className="input"
          rows={3}
          maxLength={MAX}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (e.target.value.trim()) setPreset(null)
          }}
          {...replyLang}
        />
        <span className="small muted reply-count">
          {text.length}/{MAX}
        </span>
      </label>
      {error && <p className="error">{error}</p>}
      <button type="button" className="btn" disabled={!canSend} onClick={send}>
        {sending ? t.sending : t.send}
      </button>
    </section>
  )
}
