// The opening as a small state machine (spec.md > Web app: the opening).
// Timed stages advance on their own; "ready" waits for the recipient's tap; "gift" is the end.

export const STAGES = ['arrive', 'ready', 'charge', 'burst', 'reveal', 'message', 'gift'] as const
export type Stage = (typeof STAGES)[number]

/** How long each timed stage lasts, in ms (the motion plan: drop, charge, burst, card spin-in). */
export const DURATION: Partial<Record<Stage, number>> = {
  arrive: 700,
  charge: 2400, // was 1.4 s; lengthened after Dinesh's check: "build-up is not enough"
  burst: 400,
  reveal: 1100,
  message: 900,
}

/** Reduced motion: one short fade from the closed capsule to the open card. */
export const REDUCED_FADE_MS = 400

export const index = (s: Stage) => STAGES.indexOf(s)
export const reached = (current: Stage, s: Stage) => index(current) >= index(s)

/** The stage a timed stage moves to when its time is up; null if it waits (ready) or ends (gift). */
export function after(s: Stage): Stage | null {
  if (s === 'ready' || s === 'gift') return null
  return STAGES[index(s) + 1]
}
