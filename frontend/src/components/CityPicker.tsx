import { useEffect, useId, useRef, useState } from 'react'
import { fold, searchCities, type City } from '../cities'
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

  // A city set or cleared outside the box (a saved person picked in the editor) shows in it.
  // Typing also clears `value`, but then the box already holds what was typed: left alone.
  const shown = useRef(value)
  useEffect(() => {
    const before = shown.current
    shown.current = value
    if (value) setQuery(value.label)
    else if (before && query === before.label) setQuery('')
  }, [value])

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
    if (e.key === 'Tab' && ghost) {
      // Tab accepts the ghost text; without one it moves on as usual
      e.preventDefault()
      choose(results[active])
    } else if (e.key === 'ArrowDown') {
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

  // Ghost text: the highlighted city, if it starts with what's typed, fills in ahead of the cursor
  const top = showList ? results[active] : undefined
  const ghost =
    !value && top && query.trim() && fold(top.label.slice(0, query.length)) === fold(query)
      ? top.label.slice(query.length)
      : ''

  return (
    <div className="city-picker">
      <div className="city-input-wrap">
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
        {ghost && (
          <span className="city-ghost" aria-hidden="true">
            <span className="city-ghost-typed">{query}</span>
            <span key={query.length} className="city-ghost-rest">
              {ghost}
            </span>
          </span>
        )}
      </div>
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
        <p className="hint muted">Not listed? Pick a nearby city.</p>
      )}
      {loadError && <p className="error">The city list didn't load. Check your connection and try again.</p>}
    </div>
  )
}
