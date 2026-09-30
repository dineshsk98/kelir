// Sound effects synthesized with the Web Audio API: original sounds, no audio files.
// Browsers only allow audio after a user gesture, so unlock() is called from the tap.

type Ctx = AudioContext

export class Sfx {
  private ctx: Ctx | null = null
  muted: boolean

  constructor(muted: boolean) {
    this.muted = muted
  }

  /** Create/resume the audio context. Must run inside a user gesture (the tap). */
  unlock() {
    try {
      this.ctx ??= new AudioContext()
      if (this.ctx.state === 'suspended') void this.ctx.resume()
    } catch {
      this.ctx = null // no Web Audio: stay silent
    }
  }

  close() {
    void this.ctx?.close()
    this.ctx = null
  }

  private ready(): Ctx | null {
    return this.muted || !this.ctx || this.ctx.state !== 'running' ? null : this.ctx
  }

  private tone(ctx: Ctx, freq: number, start: number, length: number, type: OscillatorType, peak: number) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + length + 0.05)
  }

  private noise(ctx: Ctx, start: number, length: number, from: number, to: number, peak: number) {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 1.2
    filter.frequency.setValueAtTime(from, start)
    filter.frequency.exponentialRampToValueAtTime(to, start + length)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + length * 0.3)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
    src.connect(filter).connect(gain).connect(ctx.destination)
    src.start(start)
  }

  /** A soft "pop" as the capsule is tapped */
  tap() {
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    this.tone(ctx, 520, t, 0.12, 'sine', 0.25)
    this.tone(ctx, 780, t + 0.04, 0.1, 'sine', 0.12)
  }

  /** A rising, trembling build-up over `seconds` */
  charge(seconds: number) {
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const tremolo = ctx.createOscillator()
    const tremoloDepth = ctx.createGain()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(180, t)
    osc.frequency.exponentialRampToValueAtTime(880, t + seconds)
    tremolo.frequency.setValueAtTime(6, t)
    tremolo.frequency.linearRampToValueAtTime(22, t + seconds)
    tremoloDepth.gain.value = 0.06
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.16, t + seconds * 0.92)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.05)
    tremolo.connect(tremoloDepth).connect(gain.gain)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    tremolo.start(t)
    osc.stop(t + seconds + 0.1)
    tremolo.stop(t + seconds + 0.1)
    this.noise(ctx, t, seconds, 400, 4000, 0.05)

    // A heartbeat underneath that speeds up and gets louder toward the burst
    let at = 0
    let gap = 0.5
    while (at < seconds - 0.08) {
      const loudness = 0.12 + 0.3 * (at / seconds)
      this.thump(ctx, t + at, loudness)
      at += gap
      gap = Math.max(0.1, gap * 0.8)
    }
  }

  private thump(ctx: Ctx, start: number, peak: number) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.setValueAtTime(110, start)
    osc.frequency.exponentialRampToValueAtTime(45, start + 0.14)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + 0.2)
  }

  /** The burst: a thump plus a bright crackle */
  burst() {
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.setValueAtTime(150, t)
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.3)
    gain.gain.setValueAtTime(0.5, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.4)
    this.noise(ctx, t, 0.5, 6000, 1500, 0.25)
  }

  /** A sparkly rising chime as the card is revealed */
  chime() {
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    ;[1046.5, 1318.5, 1568, 2093].forEach((f, i) => this.tone(ctx, f, t + i * 0.09, 0.9, 'sine', 0.12))
  }
}

const MUTE_KEY = 'capsule:muted'

export function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function saveMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    // private mode or blocked storage: the choice just isn't remembered
  }
}
