import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, type Me, type Person } from '../api'
import { savedCity, type City } from '../cities'
import { ACCOUNT_CONFIRMED } from '../account'
import { AppHeader } from '../components/AppHeader'
import { Avatar, hue } from '../components/Avatar'
import { BirthdayFields, isFeb29, type BirthdayValue } from '../components/BirthdayFields'
import { CityPicker } from '../components/CityPicker'
import { birthdayLabel, cityName, countdown, daysUntil, monthNames } from '../format'
import './People.css'

/** Everyone the sender has sent to, soonest birthday first (prd.md > Regular recipients). */
export function People({
  me,
  onSignOut,
  onMeChange,
}: {
  me: Me
  onSignOut: () => void
  onMeChange: (me: Me) => void
}) {
  const [people, setPeople] = useState<Person[] | null>(null)
  const [error, setError] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState(false)

  const load = useCallback(() => {
    api
      .listPeople()
      .then((list) => {
        setPeople(list)
        setError(false)
      })
      .catch(() => setError(true))
  }, [])

  useEffect(() => {
    load()
    // Countdowns move on: refresh when the tab comes back, once it's confirmed to be the same
    // account (App.tsx)
    window.addEventListener(ACCOUNT_CONFIRMED, load)
    return () => window.removeEventListener(ACCOUNT_CONFIRMED, load)
  }, [load])

  const remove = async (id: string) => {
    setRemoveError(false)
    try {
      await api.removePerson(id)
      setRemoving(null)
      load()
    } catch {
      setRemoveError(true)
    }
  }

  return (
    <main className="page">
      <AppHeader me={me} onSignOut={onSignOut} onMeChange={onMeChange} />

      <div className="people-head">
        <h1>Your people</h1>
      </div>

      {error && <p className="error">We couldn't load your people. Please reload the page.</p>}

      {people && people.length === 0 && (
        <section className="card people-empty">
          <h2>No one here yet</h2>
          <p className="muted">People you send to are saved here.</p>
          <Link to="/capsules/new" className="btn">
            New capsule
          </Link>
        </section>
      )}

      {people && people.length > 0 && (
        <ul className="people-grid">
          {people.map((p, i) => {
            const days = daysUntil(p.next_delivery, p.tz)
            const month = monthNames[p.birth_month - 1].slice(0, 3)
            return (
              <li
                key={p.id}
                className={editing === p.id ? 'person-card editing' : 'person-card'}
                style={{ '--hue': hue(p.email.toLowerCase()) } as React.CSSProperties}
              >
                {editing === p.id ? (
                  <PersonEditor
                    person={p}
                    onCancel={() => setEditing(null)}
                    onSaved={() => {
                      setEditing(null)
                      load() // a new birthday or city can change the order
                    }}
                  />
                ) : (
                  <>
                    <article className={i === 0 ? 'tcg next' : 'tcg'}>
                      {/* Top-left gem: how many days to go */}
                      <span className="tcg-gem" title={countdown(p.next_delivery, p.tz)}>
                        <span className="tcg-gem-text">
                          <b>{days === 0 ? '🎉' : days}</b>
                          <small>{days === 0 ? 'today' : days === 1 ? 'day' : 'days'}</small>
                        </span>
                      </span>
                      {i === 0 && <span className="tcg-next-tag">Next up</span>}
                      <div className="tcg-inner">
                        {/* The picture window; a photo will fill it */}
                        <div className="tcg-art">
                          <Avatar name={p.name} seed={p.email} size={92} />
                        </div>
                        <h2 className="tcg-name">
                          <span>{p.name}</span>
                        </h2>
                        <div className="tcg-panel">
                          {removing === p.id ? (
                            <div className="person-confirm" role="group" aria-label={`Remove ${p.name}?`}>
                              <p className="small">
                                Remove {p.name.split(' ')[0]}? Capsules you've sent them stay as they are.
                              </p>
                              {removeError && <p className="error small">We couldn't remove them. Please try again.</p>}
                              <div className="person-minor">
                                <button type="button" className="btn btn-quiet" onClick={() => setRemoving(null)}>
                                  Keep
                                </button>
                                <button type="button" className="btn btn-danger" onClick={() => remove(p.id)}>
                                  Remove
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="tcg-line">
                                {cityName(p.city_label)} <span className="tcg-when">· {countdown(p.next_delivery, p.tz)}</span>
                              </p>
                              <Link to={`/capsules/new?person=${encodeURIComponent(p.id)}`} className="btn tcg-make">
                                Make a capsule
                              </Link>
                            </>
                          )}
                        </div>
                        {/* Stat orbs: the birthday, and the collector number */}
                        <span className="tcg-orb left" aria-label={birthdayLabel(p.birth_month, p.birth_day)}>
                          <b>{p.birth_day}</b>
                          <small>{month}</small>
                        </span>
                        <span className="tcg-orb right" aria-hidden="true">
                          <b>{String(i + 1).padStart(2, '0')}</b>
                          <small>/{String(people.length).padStart(2, '0')}</small>
                        </span>
                      </div>
                    </article>
                    {removing !== p.id && (
                      <div className="tcg-tools person-minor">
                        <button type="button" className="btn btn-quiet" onClick={() => setEditing(p.id)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-quiet"
                          onClick={() => {
                            setRemoveError(false)
                            setRemoving(p.id)
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}

type Errors = { name?: string; birth_day?: string; feb29_pref?: string; city?: string; save?: string }

function PersonEditor({ person, onCancel, onSaved }: { person: Person; onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState(person.name)
  const [birthday, setBirthday] = useState<BirthdayValue>({
    birth_month: person.birth_month,
    birth_day: person.birth_day,
    feb29_pref: person.feb29_pref,
  })
  const [city, setCity] = useState<City | null>(savedCity(person.city_label, person.tz))
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const e: Errors = {}
    if (!name.trim()) e.name = 'Enter their name'
    if (!birthday.birth_month || !birthday.birth_day) e.birth_day = 'Choose their birthday'
    if (isFeb29(birthday) && !birthday.feb29_pref) e.feb29_pref = 'Choose a date for non-leap years'
    if (!city) e.city = 'Choose the city they live in'
    setErrors(e)
    if (Object.values(e).some(Boolean)) return
    setSaving(true)
    try {
      await api.updatePerson(person.id, {
        name: name.trim(),
        birth_month: birthday.birth_month!,
        birth_day: birthday.birth_day!,
        feb29_pref: isFeb29(birthday) ? birthday.feb29_pref : null,
        city_label: city!.label,
        tz: city!.tz,
      })
      onSaved()
    } catch (err) {
      setErrors({
        save:
          err instanceof ApiError && err.messages.length
            ? err.messages.join('. ')
            : "We couldn't save that. Please try again.",
      })
      setSaving(false)
    }
  }

  return (
    <form
      className="person-edit"
      aria-label={`Edit ${person.name}`}
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <div className="field">
        <label className="field-label" htmlFor={`name-${person.id}`}>
          Their name
        </label>
        <input
          id={`name-${person.id}`}
          className="input"
          value={name}
          maxLength={120}
          aria-invalid={!!errors.name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        {errors.name && <p className="error">{errors.name}</p>}
      </div>
      <p className="muted small">{person.email} · sending to a new email saves a new person</p>
      <BirthdayFields
        value={birthday}
        onChange={(change) => setBirthday((b) => ({ ...b, ...change }))}
        dayError={errors.birth_day}
        feb29Error={errors.feb29_pref}
      />
      <div className="field">
        <label className="field-label" htmlFor={`city-${person.id}`}>
          The city they live in <span className="muted field-hint">· This sets their time zone</span>
        </label>
        <CityPicker id={`city-${person.id}`} value={city} onChange={setCity} invalid={!!errors.city} />
        {errors.city && <p className="error">{errors.city}</p>}
      </div>
      {errors.save && <p className="error">{errors.save}</p>}
      <div className="person-actions">
        <button type="button" className="btn btn-quiet" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
