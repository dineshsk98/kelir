import { useEffect, useId, useState } from 'react'
import { searchCities, type City } from '../cities'
import './CityPicker.css'

/** Type-ahead city search; choosing a city sets the recipient's time zone. */
export function CityPicker({
  value,
  onChange,
  invalid,
  id,
  'aria-describedby': describedBy,
}: {
  value: City | null
  onChange: (city: City | null) => void
  invalid?: boolean
  id?: string
  'aria-describedby'?: string
}) {
  const listId = useId()
  const [query, setQuery] = useState(value?.label ?? '')
  const [results, setResults] = useState<City[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (value && query === value.label) return
    let cancelled = false
    searchCities(query)
      .then((r) => {
        if (cancelled) return
        setResults(r)
        setActive(0)
        setLoadError(false)
      })
      .catch(() => !cancelled && setLoadError(true))
    return () => {
      cancelled = true
    }
  }, [query, value])

  const choose = (city: City) => {
    onChange(city)
    setQuery(city.label)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter here means "pick a city", never "submit the form" (e.g. before the list has loaded)
    if (e.key === 'Enter' && !value) e.preventDefault()
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(results[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && results.length > 0

  return (
    <div className="city-picker">
      <input
        id={id}
        aria-describedby={describedBy}
        className="input"
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        placeholder="Start typing a city, e.g. Tokyo"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          if (value) onChange(null)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul className="city-list" id={listId} role="listbox">
          {results.map((c, i) => (
            <li
              key={`${c.label}|${c.tz}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(c)}
              // mousemove, not mouseenter: a list appearing under a still pointer must not steal the highlight
              onMouseMove={() => active !== i && setActive(i)}
            >
              <span>{c.label}</span>
              <span className="muted city-tz">{c.tz}</span>
            </li>
          ))}
        </ul>
      )}
      {value ? (
        <p className="hint">
          {value.name} · <strong>{value.tz}</strong>
        </p>
      ) : (
        <p className="hint muted">Can't find their town? Pick a nearby city in the same time zone.</p>
      )}
      {loadError && <p className="error">The city list didn't load. Check your connection and try again.</p>}
    </div>
  )
}
