import { cloneElement, useEffect, useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError, type CapsuleCreate, type Feb29Pref, type GiftKind, type Me, type SendMode } from '../api'
import type { City } from '../cities'
import { CityPicker } from '../components/CityPicker'
import { MediaGallery } from '../components/MediaGallery'
import { MediaPicker, type PickedMedia } from '../components/MediaPicker'
import { StepNav } from '../components/StepNav'
import { isValidEmail, suggestEmail } from '../email'
import { daysInMonth, deliveryMoment, monthNames } from '../format'
import './CapsuleEditor.css'

const STEPS = [
  { id: 'who', label: 'Who' },
  { id: 'message', label: 'Message' },
  { id: 'gift', label: 'Gift' },
  { id: 'when', label: 'When' },
  { id: 'preview', label: 'Preview' },
] as const
type StepId = (typeof STEPS)[number]['id']

type Draft = {
  recipient_name: string
  recipient_email: string
  birth_month: number | null
  birth_day: number | null
  feb29_pref: Feb29Pref | null
  city: City | null
  message_text: string
  gift_kind: GiftKind | null
  gift_value: string
  gift_note: string
  send_mode: SendMode
}

const EMPTY: Draft = {
  recipient_name: '',
  recipient_email: '',
  birth_month: null,
  birth_day: null,
  feb29_pref: null,
  city: null,
  message_text: '',
  gift_kind: null,
  gift_value: '',
  gift_note: '',
  send_mode: 'birthday',
}

type Errors = Partial<Record<keyof Draft | 'media', string>>

const isFeb29 = (d: Draft) => d.birth_month === 2 && d.birth_day === 29

function validate(step: StepId, d: Draft, media: PickedMedia[]): Errors {
  const e: Errors = {}
  if (step === 'who') {
    if (!d.recipient_name.trim()) e.recipient_name = 'Who is it for?'
    if (!isValidEmail(d.recipient_email.trim())) e.recipient_email = 'Enter a full email address, like name@gmail.com'
    if (!d.birth_month || !d.birth_day) e.birth_day = 'Choose their birthday'
    if (isFeb29(d) && !d.feb29_pref) e.feb29_pref = 'Choose a date for non-leap years'
    if (!d.city) e.city = 'Choose the city they live in'
  }
  if (step === 'message' || step === 'preview') {
    if (media.some((m) => m.status === 'error')) e.media = "Remove the files that couldn't be added"
    else if (media.some((m) => m.status === 'uploading')) e.media = 'Wait a moment for your files to finish uploading'
    if (!d.message_text.trim() && media.length === 0) e.message_text = 'Write them a message, or add a photo or video'
  }
  if (step === 'gift' && d.gift_kind) {
    const v = d.gift_value.trim()
    if (!v) e.gift_value = d.gift_kind === 'link' ? 'Paste the gift link' : 'Enter the gift code'
    else if (d.gift_kind === 'link' && !/^https?:\/\/\S+\.\S+/i.test(v))
      e.gift_value = 'A link starts with https://'
  }
  return e
}

function toRequest(d: Draft, media: PickedMedia[]): CapsuleCreate {
  return {
    upload_ids: media.flatMap((m) => (m.uploaded ? [m.uploaded.id] : [])),
    recipient_name: d.recipient_name.trim(),
    recipient_email: d.recipient_email.trim(),
    birth_month: d.birth_month!,
    birth_day: d.birth_day!,
    feb29_pref: isFeb29(d) ? d.feb29_pref : null,
    city_label: d.city!.label,
    tz: d.city!.tz,
    message_text: d.message_text.trim() || null,
    gift_kind: d.gift_kind,
    gift_value: d.gift_kind ? d.gift_value.trim() : null,
    gift_note: d.gift_kind ? d.gift_note.trim() || null : null,
    send_mode: d.send_mode,
  }
}

export function CapsuleEditor({ me }: { me: Me }) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [media, setMedia] = useState<PickedMedia[]>([])
  const [step, setStep] = useState<StepId>('who')
  const [reached, setReached] = useState(0)
  const [errors, setErrors] = useState<Errors>({})
  const [deliverAt, setDeliverAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step)

  const [checkingEmail, setCheckingEmail] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const emailSuggestion = suggestEmail(draft.recipient_email.trim())

  const next = async () => {
    const e = validate(step, draft, media)
    setErrors(e)
    if (step === 'who') setEmailTouched(true)
    if (Object.values(e).some(Boolean)) return
    if (step === 'who') {
      // Ask the server whether the domain can receive mail at all (a DNS lookup)
      setCheckingEmail(true)
      const check = await api.emailCheck(draft.recipient_email.trim()).catch(() => null)
      setCheckingEmail(false)
      if (check && check.accepts_mail === false) {
        setErrors({ recipient_email: "That email's domain can't receive mail. Check it for a typo." })
        return
      }
    }
    const i = stepIndex + 1
    setStep(STEPS[i].id)
    setReached((r) => Math.max(r, i))
  }

  // The exact delivery moment comes from the server's midnight engine, not the browser.
  const { birth_month, birth_day, feb29_pref, city, send_mode } = draft
  useEffect(() => {
    if (step !== 'when' && step !== 'preview') return
    if (!birth_month || !birth_day || !city) return
    let cancelled = false
    setDeliverAt(null)
    api
      .deliveryPreview({ birth_month, birth_day, feb29_pref, tz: city.tz, send_mode })
      .then((r) => !cancelled && setDeliverAt(r.deliver_at))
      .catch(() => !cancelled && setDeliverAt('error'))
    return () => {
      cancelled = true
    }
  }, [step, birth_month, birth_day, feb29_pref, city, send_mode])

  const save = async () => {
    const problems = validate('preview', draft, media)
    if (problems.media || problems.message_text) {
      setSaveError(problems.media ?? problems.message_text ?? null)
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await api.createCapsule(toRequest(draft, media))
      navigate('/history')
    } catch (e) {
      setSaveError(
        e instanceof ApiError && e.messages.length
          ? e.messages.join('. ')
          : "We couldn't save your capsule. Please try again.",
      )
      setSaving(false)
    }
  }

  const firstName = draft.recipient_name.trim().split(' ')[0] || 'them'

  return (
    <main className="page editor">
      <header className="topbar">
        <Link to="/history" className="brand">
          Birthday Capsule
        </Link>
        <Link to="/history" className="btn btn-quiet">
          Cancel
        </Link>
      </header>

      <h1>New capsule</h1>
      <StepNav steps={STEPS} current={step} reached={reached} onGo={setStep} />

      <form
        className="card editor-card"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (step === 'preview') save()
          else next()
        }}
      >
        {step === 'who' && (
          <>
            <h2>Who is it for?</h2>
            <Field label="Their name" error={errors.recipient_name}>
              <input
                className="input"
                value={draft.recipient_name}
                maxLength={120}
                autoFocus
                onChange={(e) => set('recipient_name', e.target.value)}
              />
            </Field>
            <Field label="Their email" hint="Where the capsule arrives" error={errors.recipient_email}>
              <input
                className="input"
                type="email"
                inputMode="email"
                value={draft.recipient_email}
                maxLength={320}
                onChange={(e) => set('recipient_email', e.target.value)}
                onBlur={() => setEmailTouched(true)}
              />
            </Field>
            <div aria-live="polite">
              {emailTouched && emailSuggestion && (
                <p className="email-suggestion">
                  Did you mean{' '}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => set('recipient_email', emailSuggestion)}
                  >
                    {emailSuggestion}
                  </button>
                  ?
                </p>
              )}
            </div>
            <fieldset className="field">
              <legend>Their birthday</legend>
              <div className="row">
                <select
                  className="input"
                  aria-label="Day"
                  value={draft.birth_day ?? ''}
                  onChange={(e) => set('birth_day', Number(e.target.value) || null)}
                >
                  <option value="">Day</option>
                  {Array.from({ length: daysInMonth(draft.birth_month ?? 1) }, (_, i) => (
                    <option key={i + 1}>{i + 1}</option>
                  ))}
                </select>
                <select
                  className="input"
                  aria-label="Month"
                  value={draft.birth_month ?? ''}
                  onChange={(e) => {
                    const m = Number(e.target.value) || null
                    set('birth_month', m)
                    if (m && draft.birth_day && draft.birth_day > daysInMonth(m)) set('birth_day', null)
                  }}
                >
                  <option value="">Month</option>
                  {monthNames.map((name, i) => (
                    <option key={name} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              {errors.birth_day && <p className="error">{errors.birth_day}</p>}
            </fieldset>
            {isFeb29(draft) && (
              <fieldset className="field">
                <legend>In years without Feb 29, send it on</legend>
                <div className="row">
                  {(['FEB_28', 'MAR_1'] as const).map((pref) => (
                    <label key={pref} className="choice">
                      <input
                        type="radio"
                        name="feb29"
                        checked={draft.feb29_pref === pref}
                        onChange={() => set('feb29_pref', pref)}
                      />
                      {pref === 'FEB_28' ? '28 February' : '1 March'}
                    </label>
                  ))}
                </div>
                {errors.feb29_pref && <p className="error">{errors.feb29_pref}</p>}
              </fieldset>
            )}
            <Field label="The city they live in" hint="This sets their time zone" error={errors.city}>
              <CityPicker value={draft.city} onChange={(c) => set('city', c)} invalid={!!errors.city} />
            </Field>
          </>
        )}

        {step === 'message' && (
          <>
            <h2>What do you want to tell {firstName}?</h2>
            <Field label="Your message" error={errors.message_text}>
              <textarea
                className="input message-input"
                rows={8}
                maxLength={5000}
                autoFocus
                placeholder={`Happy birthday, ${firstName}!`}
                value={draft.message_text}
                onChange={(e) => set('message_text', e.target.value)}
              />
            </Field>
            <MediaPicker
              items={media}
              onChange={(update) => {
                setMedia(update)
                setErrors((e) => ({ ...e, media: undefined, message_text: undefined }))
              }}
            />
            {errors.media && <p className="error">{errors.media}</p>}
          </>
        )}

        {step === 'gift' && (
          <>
            <h2>Add a little gift?</h2>
            <p className="muted">Optional. A link to something you bought, or a code they can redeem.</p>
            <div className="row" role="radiogroup" aria-label="Gift">
              {([null, 'link', 'code'] as const).map((kind) => (
                <label key={kind ?? 'none'} className="choice">
                  <input
                    type="radio"
                    name="gift"
                    checked={draft.gift_kind === kind}
                    onChange={() => set('gift_kind', kind)}
                  />
                  {kind === null ? 'No gift' : kind === 'link' ? 'A link' : 'A code'}
                </label>
              ))}
            </div>
            {draft.gift_kind && (
              <>
                <Field
                  label={draft.gift_kind === 'link' ? 'Gift link' : 'Gift code'}
                  hint={draft.gift_kind === 'code' ? `Hidden until ${firstName} taps to reveal it` : undefined}
                  error={errors.gift_value}
                >
                  <input
                    className="input"
                    value={draft.gift_value}
                    maxLength={draft.gift_kind === 'link' ? 2000 : 200}
                    placeholder={draft.gift_kind === 'link' ? 'https://' : 'XXXX-XXXX-XXXX'}
                    onChange={(e) => set('gift_value', e.target.value)}
                  />
                </Field>
                <Field label="A note with it (optional)">
                  <input
                    className="input"
                    value={draft.gift_note}
                    maxLength={300}
                    placeholder="Your gift is on its way!"
                    onChange={(e) => set('gift_note', e.target.value)}
                  />
                </Field>
              </>
            )}
          </>
        )}

        {step === 'when' && (
          <>
            <h2>When should it arrive?</h2>
            <div role="radiogroup" aria-label="When">
              {(
                [
                  ['birthday', 'On their birthday', ' at the first moment of their day'],
                  ['now', 'Send now', ' a belated wish, or just because'],
                ] as const
              ).map(([mode, title, detail]) => (
                <label key={mode} className="choice block">
                  <input
                    type="radio"
                    name="when"
                    checked={draft.send_mode === mode}
                    onChange={() => set('send_mode', mode)}
                  />
                  <span>
                    <strong>{title}</strong>
                    <span className="muted">{detail}</span>
                  </span>
                </label>
              ))}
            </div>
            <DeliveryNote deliverAt={deliverAt} draft={draft} />
          </>
        )}

        {step === 'preview' && (
          <>
            <h2>This is what {firstName} will get</h2>
            <DeliveryNote deliverAt={deliverAt} draft={draft} />
            <div className="preview-email">
              <p className="muted small">Email to {draft.recipient_email.trim()}</p>
              <p>
                <strong>{me.name} has sent you a surprise for your special day.</strong>
              </p>
            </div>
            <div className="preview-card">
              <p className="muted small">From {me.name}</p>
              {draft.message_text.trim() && <p className="preview-message">{draft.message_text.trim()}</p>}
              {media.length > 0 && (
                <MediaGallery items={media.map((m) => ({ key: m.key, kind: m.kind, url: m.localUrl }))} />
              )}
              {draft.gift_kind && (
                <div className="preview-gift">
                  <p className="small muted">{draft.gift_kind === 'link' ? 'Your gift' : 'Your gift code'}</p>
                  {draft.gift_note.trim() && <p>{draft.gift_note.trim()}</p>}
                  {draft.gift_kind === 'link' ? (
                    <span className="btn">Open your gift</span>
                  ) : (
                    <span className="gift-code">Tap to reveal</span>
                  )}
                </div>
              )}
            </div>
            <p className="muted small">They'll see this as a gift opening when they tap the link.</p>
            {saveError && <p className="error">{saveError}</p>}
          </>
        )}

        <div className="editor-actions">
          {stepIndex > 0 ? (
            <button type="button" className="btn btn-quiet" onClick={() => setStep(STEPS[stepIndex - 1].id)}>
              Back
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="btn" disabled={saving || checkingEmail}>
            {step === 'preview'
              ? saving
                ? 'Saving…'
                : draft.send_mode === 'now'
                  ? 'Send it now'
                  : 'Schedule it'
              : checkingEmail
                ? 'Checking…'
                : 'Next'}
          </button>
        </div>
      </form>
    </main>
  )
}

/** A labelled form field. The label is tied to the single child control via its id. */
function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactElement<{ id?: string; 'aria-describedby'?: string }>
}) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {hint && <span className="muted field-hint"> · {hint}</span>}
      </label>
      {cloneElement(children, { id, 'aria-describedby': error ? errorId : undefined })}
      {error && (
        <p className="error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  )
}

function DeliveryNote({ deliverAt, draft }: { deliverAt: string | null; draft: Draft }) {
  if (!draft.city) return null
  let text: string
  if (deliverAt === 'error') text = "We couldn't work out the delivery time. Check the details and try again."
  else if (!deliverAt) text = 'Working out their midnight…'
  else if (draft.send_mode === 'now') text = 'Delivers as soon as you confirm.'
  else text = `Delivers ${deliveryMoment(deliverAt, draft.city.tz, draft.city.label)}`
  return <p className="delivery-note">{text}</p>
}
