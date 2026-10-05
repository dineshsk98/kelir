import { useEffect, useId, useState } from 'react'
import { api, ApiError, type SignedIn } from '../api'
import { isValidEmail, suggestEmail } from '../email'
import type { MessageLang } from '../languages'
import { SIGN_IN_COPY, type SignInCopy } from '../signInCopy'
import { GoogleButton } from './GoogleButton'
import './SignIn.css'

/**
 * Sign in with Google, or with a code emailed to you (prd.md > Sign-in and history). The
 * welcome page uses it in English; a capsule link uses it at the cake, in the capsule's
 * language. Either way it's the same account for the same email.
 */
export function SignInChoice({
  lang = 'en',
  emailPlaceholder,
  onSignedIn,
}: {
  lang?: MessageLang
  /** e.g. the masked email a capsule was sent to */
  emailPlaceholder?: string
  onSignedIn: (me: SignedIn) => void
}) {
  const copy = SIGN_IN_COPY[lang]
  // null while asking; '' when Google sign-in isn't set up (email still works)
  const [clientId, setClientId] = useState<string | null>(null)
  const [byEmail, setByEmail] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .config()
      .then((c) => setClientId(c.google_client_id))
      .catch(() => setClientId(''))
  }, [])

  const google = async (credential: string) => {
    setError(null)
    try {
      onSignedIn({ ...(await api.signInWithGoogle(credential)), created: false })
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? copy.googleFailed : copy.failed)
    }
  }

  return (
    <div className="signin-choice">
      {clientId && (
        <>
          <GoogleButton clientId={clientId} locale={copy.googleLocale} text="continue_with" onCredential={google} />
          <p className="signin-or">{copy.or}</p>
        </>
      )}
      {byEmail ? (
        <EmailSignIn copy={copy} lang={lang} placeholder={emailPlaceholder} onSignedIn={onSignedIn} />
      ) : (
        <button type="button" className="signin-email-start" onClick={() => setByEmail(true)}>
          <span aria-hidden="true">✉️</span> {copy.continueWithEmail}
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}

/** "Did you mean aiko@gmail.com?" for a likely typo (gmial.com, gmail.con…); one tap fixes it */
function DidYouMean({
  copy,
  suggestion,
  onPick,
}: {
  copy: SignInCopy
  suggestion: string
  onPick: (email: string) => void
}) {
  const [before, after = ''] = copy.didYouMean.split('{email}')
  return (
    <p className="signin-suggest" aria-live="polite">
      {before}
      <button type="button" className="signin-link" onClick={() => onPick(suggestion)}>
        {suggestion}
      </button>
      {after}
    </p>
  )
}

/** Type your email, get a 6-digit code, type it in. Six digits sign in by themselves. */
function EmailSignIn({
  copy,
  lang,
  placeholder,
  onSignedIn,
}: {
  copy: SignInCopy
  lang: MessageLang
  placeholder?: string
  onSignedIn: (me: SignedIn) => void
}) {
  const id = useId()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendAt, setResendAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  // The "send a new code" countdown
  useEffect(() => {
    if (step !== 'code') return
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(tick)
  }, [step])
  const waitSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000))

  const typed = email.trim()
  // The same checks as the capsule editor's recipient email (email.ts)
  const suggestion = suggestEmail(typed)
  const [emailTouched, setEmailTouched] = useState(false)

  const send = async () => {
    if (!isValidEmail(typed)) {
      setEmailTouched(true)
      return setError(copy.badEmail)
    }
    setBusy(true)
    setError(null)
    try {
      const sent = await api.sendSignInCode(typed, lang)
      setEmail(sent.sent_to)
      setStep('code')
      setCode('')
      setResendAt(Date.now() + sent.resend_after * 1000)
      setNow(Date.now())
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CODE_TOO_SOON') {
        setError(copy.tooSoon)
        setResendAt(Date.now() + Number(e.detail.retry_after ?? 60) * 1000)
        setStep('code') // a code is already on its way
      } else {
        setError(
          e instanceof ApiError && e.status === 422
            ? copy.badEmail
            : e instanceof ApiError && e.code === 'CODE_LIMIT'
              ? copy.limit
              : e instanceof ApiError && e.code === 'CODE_NOT_SENT'
                ? copy.notSent
                : copy.failed,
        )
      }
    } finally {
      setBusy(false)
    }
  }

  const verify = async (value: string) => {
    setBusy(true)
    setError(null)
    try {
      onSignedIn(await api.signInWithCode(email, value))
    } catch (e) {
      setCode('')
      setError(
        e instanceof ApiError && e.code === 'CODE_WRONG'
          ? copy.wrongCode(Number(e.detail.tries_left ?? 0))
          : e instanceof ApiError && e.code === 'CODE_EXPIRED'
            ? copy.expired
            : copy.failed,
      )
      setBusy(false)
    }
  }

  if (step === 'email')
    return (
      <form
        className="signin-email"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (email.trim()) void send()
        }}
      >
        <label className="signin-label" htmlFor={`${id}-email`}>
          {copy.emailLabel}
        </label>
        <input
          id={`${id}-email`}
          className="input"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          maxLength={320}
          placeholder={placeholder}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setError(null)
          }}
          onBlur={() => setEmailTouched(true)}
        />
        {emailTouched && suggestion && <DidYouMean copy={copy} suggestion={suggestion} onPick={setEmail} />}
        <button type="submit" className="btn" disabled={busy || !typed}>
          {busy ? copy.sending : copy.sendCode}
        </button>
        {error && <p className="error" role="alert">{error}</p>}
      </form>
    )

  return (
    <form
      className="signin-email"
      onSubmit={(e) => {
        e.preventDefault()
        if (code.length === 6) void verify(code)
      }}
    >
      <p className="signin-sent" aria-live="polite">
        {copy.codeSent(email)}
      </p>
      <label className="signin-label" htmlFor={`${id}-code`}>
        {copy.codeLabel}
      </label>
      <input
        id={`${id}-code`}
        className="input signin-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        value={code}
        disabled={busy}
        onChange={(e) => {
          // Digits only (a pasted "123 456" works too); six of them sign in straight away
          const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
          setCode(digits)
          if (digits.length === 6) void verify(digits)
        }}
      />
      <button type="submit" className="btn" disabled={busy || code.length !== 6}>
        {busy ? copy.checking : copy.confirm}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="signin-links">
        <button type="button" className="signin-link" disabled={busy || waitSeconds > 0} onClick={() => void send()}>
          {waitSeconds > 0 ? copy.resendIn(waitSeconds) : copy.resend}
        </button>
        <button
          type="button"
          className="signin-link"
          onClick={() => {
            setStep('email')
            setError(null)
          }}
        >
          {copy.otherEmail}
        </button>
      </div>
    </form>
  )
}
