export function StepNav<T extends string>({
  steps,
  current,
  reached,
  locked = [],
  onGo,
}: {
  steps: readonly { id: T; label: string }[]
  current: T
  /** Index of the furthest step the sender has unlocked */
  reached: number
  /** Steps that can't be changed any more (e.g. who and when, once delivered) */
  locked?: readonly T[]
  onGo: (id: T) => void
}) {
  return (
    <ol className="steps">
      {steps.map((s, i) => (
        <li key={s.id}>
          <button
            type="button"
            className={s.id === current ? 'step current' : 'step'}
            aria-current={s.id === current ? 'step' : undefined}
            disabled={i > reached || locked.includes(s.id)}
            title={locked.includes(s.id) ? 'Already delivered: this can no longer change' : undefined}
            onClick={() => onGo(s.id)}
          >
            <span className="step-num">{i + 1}</span> {s.label}
            {locked.includes(s.id) && <span aria-hidden="true"> 🔒</span>}
          </button>
        </li>
      ))}
    </ol>
  )
}
