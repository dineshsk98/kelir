import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, type Me, type Person } from '../api'
import type { City } from '../cities'
import { BirthdayFields, isFeb29, type BirthdayValue } from '../components/BirthdayFields'
import { CityPicker } from '../components/CityPicker'
import { birthdayLabel, cityName, countdown, deliveryMoment } from '../format'
import './People.css'

/** Everyone the sender has sent to, soonest birthday first (prd.md > Regular recipients). */
export function People({ me, onSignOut }: { me: Me; onSignOut: () => void }) {
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
    // Countdowns move on: refresh when the tab regains focus
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
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
      <header className="topbar">
        <Link to="/history" className="brand">
          Birthday Capsule
        </Link>
        <span>
          <span className="muted">{me.email}</span>
          <button className="btn btn-quiet" onClick={onSignOut}>
            Sign out
          </button>
        </span>
      </header>

      <div className="people-head">
        <div>
          <h1>Your people</h1>
          <p className="muted">Everyone you've sent a capsule to, soonest birthday first</p>
        </div>
        <Link to="/history" className="btn btn-quiet">
          Your capsules
        </Link>
      </div>

      {error && <p className="error">We couldn't load your people. Please reload the page.</p>}

      {people && people.length === 0 && (
        <section className="card people-empty">
          <h2>No one here yet</h2>
          <p className="muted">Everyone you send a capsule to is saved here, so their next birthday is quick.</p>
          <Link to="/capsules/new" className="btn">
            New capsule
          </Link>
        </section>
      )}

      {people && people.length > 0 && (
        <ul className="people-list">
          {people.map((p) => (
            <li key={p.id} className="person-row">
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
                  <div className="person-main">
                    <p>
                      <strong>{p.name}</strong>{' '}
                      <span className="person-when">· {countdown(p.next_delivery, p.tz)}</span>
                    </p>
                    <p className="muted small">{arrives(p)}</p>
                    <p className="muted small">
                      {birthdayLabel(p.birth_month, p.birth_day)} · {p.email}
                    </p>
                  </div>
                  {removing === p.id ? (
                    <div className="person-confirm" role="group" aria-label={`Remove ${p.name}?`}>
                      <p className="small">
                        Remove {p.name.split(' ')[0]}? Capsules you've sent them stay as they are.
                      </p>
                      {removeError && <p className="error small">We couldn't remove them. Please try again.</p>}
                      <div className="person-actions">
                        <button type="button" className="btn btn-quiet" onClick={() => setRemoving(null)}>
                          Keep
                        </button>
                        <button type="button" className="btn btn-danger" onClick={() => remove(p.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="person-actions">
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
          ))}
        </ul>
      )}
    </main>
  )
}

/** When a capsule for them would arrive: "00:00, 14 Mar in Tokyo (20:30, 13 Mar your time)" */
function arrives(p: Person): string {
  if (new Date(p.next_delivery) <= new Date()) return `It's already their birthday in ${cityName(p.city_label)}`
  return deliveryMoment(p.next_delivery, p.tz, p.city_label)
}

type Errors = { name?: string; birth_day?: string; feb29_pref?: string; city?: string; save?: string }

function PersonEditor({ person, onCancel, onSaved }: { person: Person; onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState(person.name)
  const [birthday, setBirthday] = useState<BirthdayValue>({
    birth_month: person.birth_month,
    birth_day: person.birth_day,
    feb29_pref: person.feb29_pref,
  })
  const [city, setCity] = useState<City | null>({
    name: cityName(person.city_label),
    region: '',
    country: '',
    tz: person.tz,
    label: person.city_label,
  })
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
