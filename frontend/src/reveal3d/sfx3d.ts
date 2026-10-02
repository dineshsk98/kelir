// The gift box's sounds, synthesized with Web Audio like the first opening's (no audio files).

import { Sfx } from '../reveal/sfx'

type Stretch = { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode }

// "Happy Birthday to You" (public domain) in C major, 3/4: [note, beats], with an optional
// left-hand bass note on the beat it starts. 0 = rest.
const C3 = 130.81, F3 = 174.61, G3 = 196.0
const G4 = 392.0, A4 = 440.0, B4 = 493.88, C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99
const TUNE: [number, number, number?][] = [
  [G4, 0.75], [G4, 0.25],
  [A4, 1, C3], [G4, 1], [C5, 1],
  [B4, 2, G3], [G4, 0.75], [G4, 0.25],
  [A4, 1, G3], [G4, 1], [D5, 1],
  [C5, 2, C3], [G4, 0.75], [G4, 0.25],
  [G5, 1, C3], [E5, 1], [C5, 1],
  [B4, 1, F3], [A4, 1], [F5, 0.75], [F5, 0.25],
  [E5, 1, C3], [C5, 1, G3], [D5, 1],
  [C5, 3, C3],
]
const BEAT = 0.52 // seconds: an unhurried, singable tempo
const MUSIC_LEVEL = 0.5
/** While another sound (or her voice note or video) plays, the tune drops to this */
const DUCKED_LEVEL = 0.1

export class GiftSfx extends Sfx {
  private stretching: Stretch | null = null
  /** The tune plays through this, so mute and ducking can change its volume mid-song */
  private musicBus: GainNode | null = null
  private applause: AudioBuffer | null = null
  /** When the next round of the tune must start (audio-clock seconds) */
  private nextRound = 0
  private tuneTimer: number | undefined
  /** Ducking: sounds that play for a while (until a time) and ones held open (her media) */
  private duckedUntil = 0
  private duckHolds = 0
  private duckTimers = new Set<number>()

  /** Use this (not `muted =`) so a tune that's already playing follows the mute button */
  setMuted(muted: boolean) {
    this.muted = muted
    this.applyMusicLevel()
  }

  /** The tune's volume right now: off when muted, low under other sounds, full otherwise */
  private applyMusicLevel() {
    const bus = this.musicBus
    if (!bus) return
    const now = bus.context.currentTime
    const ducked = this.duckHolds > 0 || now < this.duckedUntil
    const level = this.muted ? 0 : ducked ? DUCKED_LEVEL : MUSIC_LEVEL
    // Drop quickly so the other sound is clear; come back slowly, like a swell
    bus.gain.cancelScheduledValues(now)
    bus.gain.setTargetAtTime(level, now, ducked || this.muted ? 0.08 : 0.6)
  }

  /** Lower the tune for a sound that lasts `seconds`, then let it swell back */
  private duck(seconds: number) {
    const ctx = this.ctx
    if (!ctx || !this.musicBus) return
    this.duckedUntil = Math.max(this.duckedUntil, ctx.currentTime + seconds)
    this.applyMusicLevel()
    const timer = window.setTimeout(() => {
      this.duckTimers.delete(timer)
      this.applyMusicLevel()
    }, seconds * 1000 + 30)
    this.duckTimers.add(timer)
  }

  /** Keep the tune low while her voice note or video plays (call with false when it stops) */
  holdDuck(on: boolean) {
    this.duckHolds = Math.max(0, this.duckHolds + (on ? 1 : -1))
    this.applyMusicLevel()
  }

  /** The candles go out: a small crowd clapping, quickly building then trailing off */
  clap() {
    const ctx = this.live()
    if (!ctx) return
    this.duck(2.9)
    // One short burst of noise is one clap; the same buffer serves them all
    if (!this.applause) {
      const len = Math.ceil(ctx.sampleRate * 0.05)
      this.applause = ctx.createBuffer(1, len, ctx.sampleRate)
      const data = this.applause.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.18))
    }
    const t = ctx.currentTime + 0.05
    const length = 2.6
    for (let i = 0; i < 90; i++) {
      // More claps early on, thinning out towards the end
      const at = t + length * Math.random() ** 1.6
      const src = ctx.createBufferSource()
      src.buffer = this.applause
      src.playbackRate.value = 0.8 + Math.random() * 0.5 // different hands, different pitches
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 900 + Math.random() * 1600
      filter.Q.value = 1.1
      const gain = ctx.createGain()
      gain.gain.value = 0.09 + 0.17 * Math.random() * (1 - (at - t) / length)
      src.connect(filter).connect(gain).connect(ctx.destination)
      src.start(at)
    }
  }

  /** Happy Birthday on a soft piano, round after round for as long as the capsule is open */
  birthdayTune(delay = 0) {
    const ctx = this.ctx
    if (!ctx || ctx.state === 'closed' || this.musicBus) return
    const bus = ctx.createGain()
    bus.gain.value = this.muted ? 0 : MUSIC_LEVEL
    bus.connect(ctx.destination)
    this.musicBus = bus
    this.nextRound = ctx.currentTime + 0.1 + delay
    // Notes are scheduled a round at a time, a couple of seconds ahead, so the song never
    // stops and never piles up hundreds of notes in advance
    const topUp = () => {
      if (ctx.state === 'closed') return
      // A background tab can delay this timer; never schedule a round in the past (its notes
      // would all sound at once), just start the next one fresh
      if (this.nextRound < ctx.currentTime) this.nextRound = ctx.currentTime + 0.2
      while (this.nextRound - ctx.currentTime < 3) this.nextRound = this.playRound(ctx, bus, this.nextRound)
    }
    topUp()
    this.tuneTimer = window.setInterval(topUp, 1000)
  }

  /** One time through the song from `at`; returns when the next round should start */
  private playRound(ctx: AudioContext, bus: GainNode, at: number) {
    for (const [note, beats, bass] of TUNE) {
      if (note) this.piano(ctx, bus, note, at, Math.max(0.9, beats * BEAT * 1.6), 0.16)
      if (bass) {
        this.piano(ctx, bus, bass, at, 2.4, 0.11)
        this.piano(ctx, bus, bass * 1.5, at + 0.02, 2.2, 0.05) // a fifth above: fuller left hand
      }
      at += beats * BEAT
    }
    return at + 2 * BEAT // a breath between rounds
  }

  /** One piano-like note: a few harmonics, a quick strike and a long fading ring */
  private piano(ctx: AudioContext, out: AudioNode, freq: number, start: number, length: number, peak: number) {
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.008)
    gain.gain.exponentialRampToValueAtTime(peak * 0.35, start + 0.25)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
    // A soft low-pass keeps it warm rather than buzzy
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = Math.min(5000, freq * 6)
    gain.connect(tone).connect(out)
    for (const [mult, level, type] of [[1, 1, 'triangle'], [2, 0.35, 'sine'], [3, 0.12, 'sine']] as const) {
      const osc = ctx.createOscillator()
      const partial = ctx.createGain()
      osc.type = type
      osc.frequency.value = freq * mult
      partial.gain.value = level
      osc.connect(partial).connect(gain)
      osc.start(start)
      osc.stop(start + length + 0.05)
    }
  }

  /**
   * Like ready(), but also accepts a context that is still resuming. On iOS the context only
   * starts running a moment after the first touch; sounds scheduled meanwhile play once it does.
   */
  private live(): AudioContext | null {
    return this.muted || !this.ctx || this.ctx.state === 'closed' ? null : this.ctx
  }

  /** First touch on the ribbon: a soft midnight bell */
  touch() {
    const ctx = this.live()
    if (!ctx) return
    this.duck(1.3)
    const t = ctx.currentTime
    this.tone(ctx, 1046.5, t, 1.3, 'sine', 0.12)
    this.tone(ctx, 1568, t + 0.02, 0.9, 'sine', 0.05)
  }

  /** Satin stretching while she pulls: filtered noise that rises with the pull (0..1) */
  stretchStart() {
    const ctx = this.live()
    if (!ctx || this.stretching) return
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 2
    filter.frequency.value = 400
    const gain = ctx.createGain()
    gain.gain.value = 0.0001
    src.connect(filter).connect(gain).connect(ctx.destination)
    src.start()
    this.stretching = { src, filter, gain }
    this.holdDuck(true) // the tune stays low while she pulls
  }

  stretch(pull: number) {
    const s = this.stretching
    if (!s) return
    const t = s.src.context.currentTime
    s.filter.frequency.setTargetAtTime(400 + 2600 * pull, t, 0.03)
    s.gain.gain.setTargetAtTime(this.muted ? 0.0001 : 0.015 + 0.09 * pull, t, 0.03)
  }

  stretchStop() {
    const s = this.stretching
    if (!s) return
    this.stretching = null
    this.holdDuck(false)
    const t = s.src.context.currentTime
    s.gain.gain.setTargetAtTime(0.0001, t, 0.05)
    s.src.stop(t + 0.3)
  }

  /** The bow slips loose: a quick satin zip and a soft flutter */
  zip() {
    const ctx = this.live()
    if (!ctx) return
    this.duck(0.8)
    const t = ctx.currentTime
    this.noise(ctx, t, 0.28, 1200, 7000, 0.16)
    this.noise(ctx, t + 0.22, 0.45, 900, 250, 0.05)
  }

  /** The build-up under the lid (the first opening's), with the tune lowered for it */
  charge(seconds: number) {
    this.duck(seconds + 0.6)
    super.charge(seconds)
  }

  /** The lid pops: the first opening's burst plus a short pop on top */
  burst() {
    this.duck(1.5)
    super.burst()
    const ctx = this.ready()
    if (!ctx) return
    this.tone(ctx, 330, ctx.currentTime, 0.12, 'triangle', 0.2)
  }

  /** The photocard rises: a warm chord swell under the sparkle chime */
  swell() {
    const ctx = this.ready()
    if (!ctx) return
    this.duck(2.6)
    const t = ctx.currentTime
    ;[261.63, 329.63, 392, 523.25].forEach((f, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = f
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.linearRampToValueAtTime(0.05, t + 0.35 + i * 0.04)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.4)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t + i * 0.04)
      osc.stop(t + 2.5)
    })
    this.chime()
  }

  close() {
    this.stretchStop()
    window.clearInterval(this.tuneTimer)
    this.duckTimers.forEach((t) => window.clearTimeout(t))
    this.duckTimers.clear()
    this.musicBus = null
    super.close()
  }
}
