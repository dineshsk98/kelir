import { useId } from 'react'
import type { Feb29Pref } from '../api'
import { daysInMonth, monthNames } from '../format'
import './BirthdayFields.css'

export type BirthdayValue = {
  birth_month: number | null
  birth_day: number | null
  feb29_pref: Feb29Pref | null
}

export const isFeb29 = (b: BirthdayValue) => b.birth_month === 2 && b.birth_day === 29

/** Day and month (no year: it's a birthday), plus the non-leap-year choice for 29 February.
 *  Used by the capsule editor's Who step and the People page. */
export function BirthdayFields({
  value,
  onChange,
  dayError,
  feb29Error,
}: {
  value: BirthdayValue
  onChange: (change: Partial<BirthdayValue>) => void
  dayError?: string
  feb29Error?: string
}) {
  const feb29Name = useId()
  return (
    <>
      <fieldset className="field">
        <legend>Their birthday</legend>
        <div className="birthday-months" role="group" aria-label="Month">
          {monthNames.map((name, i) => (
            <button
              key={name}
              type="button"
              className="birthday-chip"
              aria-pressed={value.birth_month === i + 1}
              onClick={() => {
                const m = i + 1
                const dayFits = !value.birth_day || value.birth_day <= daysInMonth(m)
                onChange(dayFits ? { birth_month: m } : { birth_month: m, birth_day: null })
              }}
            >
              {name.slice(0, 3)}
            </button>
          ))}
        </div>
        <div className="birthday-days" role="group" aria-label="Day">
          {Array.from({ length: daysInMonth(value.birth_month ?? 1) }, (_, i) => (
            <button
              key={i + 1}
              type="button"
              className="birthday-chip"
              aria-pressed={value.birth_day === i + 1}
              onClick={() => onChange({ birth_day: i + 1 })}
            >
              {i + 1}
            </button>
          ))}
        </div>
        {dayError && <p className="error">{dayError}</p>}
      </fieldset>
      {isFeb29(value) && (
        <fieldset className="field">
          <legend>In years without Feb 29, send it on</legend>
          <div className="row">
            {(['FEB_28', 'MAR_1'] as const).map((pref) => (
              <label key={pref} className="choice">
                <input
                  type="radio"
                  name={feb29Name}
                  checked={value.feb29_pref === pref}
                  onChange={() => onChange({ feb29_pref: pref })}
                />
                {pref === 'FEB_28' ? '28 February' : '1 March'}
              </label>
            ))}
          </div>
          {feb29Error && <p className="error">{feb29Error}</p>}
        </fieldset>
      )}
    </>
  )
}
