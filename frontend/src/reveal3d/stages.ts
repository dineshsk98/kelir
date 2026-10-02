// The 3D opening as a small state machine (design canvas "Capsule Reveal").
// A gift box she unties herself: timed stages advance on their own, "pull" waits for her
// to pull the ribbon, and "explore" is the end.

export const STAGES = ['arrive', 'pull', 'untie', 'charge', 'burst', 'rise', 'explore'] as const
export type Stage = (typeof STAGES)[number]

/** How long each timed stage lasts, in ms: 4.8 s of motion in all. */
export const DURATION: Partial<Record<Stage, number>> = {
  arrive: 800,
  untie: 700,
  charge: 1300,
  burst: 500,
  rise: 1500,
}

/** Reduced motion: one short fade from the closed box to the open one. */
export const REDUCED_FADE_MS = 400

export const index = (s: Stage) => STAGES.indexOf(s)
export const reached = (current: Stage, s: Stage) => index(current) >= index(s)

/** The stage a timed stage moves to when its time is up; null if it waits (pull) or ends (explore). */
export function after(s: Stage): Stage | null {
  if (s === 'pull' || s === 'explore') return null
  return STAGES[index(s) + 1]
}
