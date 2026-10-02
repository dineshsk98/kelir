// The 3D opening as a small state machine (design canvas "Capsule Reveal").
// A birthday cake whose candle she blows out, then a gift box she unties herself: timed
// stages advance on their own, "blow" and "pull" wait for her, and "explore" is the end.

export const STAGES = [
  'cake_arrive',
  'blow',
  'cake_aside',
  'arrive',
  'pull',
  'untie',
  'charge',
  'burst',
  'rise',
  'explore'
] as const
export type Stage = (typeof STAGES)[number]

/** How long each timed stage lasts, in ms: 8.9 s of motion in all. */
export const DURATION: Partial<Record<Stage, number>> = {
  cake_arrive: 1500,
  cake_aside: 2600, // flames out and smoke (1 s), then the slow glide aside (1.6 s): see .r3d-cake.blown

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

/** The stages that wait for her or show something still: cake, candle, the box at rest. */
const STILL: readonly Stage[] = ['cake_arrive', 'blow', 'cake_aside', 'arrive', 'pull']

/** What the scene draws. With reduced motion, the opening's moving stages (untie to rise)
 *  show the open box straight away; the stages before it stay as they are, so nothing is
 *  revealed before she has blown out the candle and pulled the ribbon. */
export const sceneStage = (stage: Stage, reduced: boolean): Stage =>
  reduced && !STILL.includes(stage) ? 'explore' : stage

/** The stage a timed stage moves to when its time is up; null if it waits (pull, blow) or ends (explore). */
export function after(s: Stage): Stage | null {
  if (s === 'pull' || s === 'blow' || s === 'explore') return null
  return STAGES[index(s) + 1]
}
