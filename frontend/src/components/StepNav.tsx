export function StepNav<T extends string>({
  steps,
  current,
  reached,
  onGo,
}: {
  steps: readonly { id: T; label: string }[]
  current: T
  /** Index of the furthest step the sender has unlocked */
  reached: number
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
            disabled={i > reached}
            onClick={() => onGo(s.id)}
          >
            <span className="step-num">{i + 1}</span> {s.label}
          </button>
        </li>
      ))}
    </ol>
  )
}
