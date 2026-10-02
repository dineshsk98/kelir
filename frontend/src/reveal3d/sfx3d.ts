// The gift box's sounds, synthesized with Web Audio like the first opening's (no audio files).

import { Sfx } from '../reveal/sfx'

type Stretch = { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode }

export class GiftSfx extends Sfx {
  private stretching: Stretch | null = null

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
    const t = s.src.context.currentTime
    s.gain.gain.setTargetAtTime(0.0001, t, 0.05)
    s.src.stop(t + 0.3)
  }

  /** The bow slips loose: a quick satin zip and a soft flutter */
  zip() {
    const ctx = this.live()
    if (!ctx) return
    const t = ctx.currentTime
    this.noise(ctx, t, 0.28, 1200, 7000, 0.16)
    this.noise(ctx, t + 0.22, 0.45, 900, 250, 0.05)
  }

  /** The lid pops: the first opening's burst plus a short pop on top */
  burst() {
    super.burst()
    const ctx = this.ready()
    if (!ctx) return
    this.tone(ctx, 330, ctx.currentTime, 0.12, 'triangle', 0.2)
  }

  /** The photocard rises: a warm chord swell under the sparkle chime */
  swell() {
    const ctx = this.ready()
    if (!ctx) return
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
    super.close()
  }
}
