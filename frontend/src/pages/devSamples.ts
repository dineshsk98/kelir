import fixWebmDuration from 'fix-webm-duration'

// Development only: a sample voice note and video made in the browser, so the players can
// be tried on /dev/reveal without a recorded capsule. Nothing is downloaded or uploaded.

/** A 6-second chime tune as a WAV file (a stand-in for a voice note) */
export function sampleVoiceNote(): string {
  const rate = 22050
  const notes = [523, 659, 784, 659, 698, 880, 784, 523] // C E G E F A G C
  const noteLen = 0.75
  const samples = new Int16Array(Math.round(rate * noteLen * notes.length))
  notes.forEach((freq, n) => {
    const start = Math.round(n * noteLen * rate)
    for (let i = 0; i < noteLen * rate; i++) {
      const t = i / rate
      const fade = Math.exp(-t * 4)
      samples[start + i] = Math.round(9000 * fade * Math.sin(2 * Math.PI * freq * t))
    }
  })

  const header = new DataView(new ArrayBuffer(44))
  const text = (at: number, s: string) => [...s].forEach((c, i) => header.setUint8(at + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  header.setUint32(4, 36 + samples.byteLength, true)
  text(8, 'WAVEfmt ')
  header.setUint32(16, 16, true) // format chunk size
  header.setUint16(20, 1, true) // PCM
  header.setUint16(22, 1, true) // mono
  header.setUint32(24, rate, true)
  header.setUint32(28, rate * 2, true) // bytes per second
  header.setUint16(32, 2, true) // bytes per sample frame
  header.setUint16(34, 16, true) // bits per sample
  text(36, 'data')
  header.setUint32(40, samples.byteLength, true)
  return URL.createObjectURL(new Blob([header, samples], { type: 'audio/wav' }))
}

/** A 5-second labelled colour animation recorded from a canvas (a stand-in for a video) */
export async function sampleVideo(): Promise<string> {
  const seconds = 5
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 360
  const g = canvas.getContext('2d')!
  const recorder = new MediaRecorder(canvas.captureStream(30))
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => chunks.push(e.data)
  const done = new Promise((resolve) => (recorder.onstop = resolve))

  const began = performance.now()
  const draw = () => {
    const t = (performance.now() - began) / 1000
    g.fillStyle = `hsl(${(t * 60) % 360} 70% 45%)`
    g.fillRect(0, 0, 640, 360)
    g.fillStyle = '#fff'
    g.font = '40px sans-serif'
    g.textAlign = 'center'
    g.fillText('Sample video', 320, 170)
    g.fillText(`${t.toFixed(1)} s`, 320, 230)
  }
  draw()
  recorder.start()
  // A timer, not requestAnimationFrame: it keeps drawing in a background tab
  const timer = setInterval(draw, 1000 / 30)
  await new Promise((r) => setTimeout(r, seconds * 1000))
  clearInterval(timer)
  recorder.stop()
  await done
  // Browsers leave the length out of recorded WebM; the real recorder fixes it the same way
  const blob = await fixWebmDuration(new Blob(chunks, { type: recorder.mimeType }), seconds * 1000, { logger: false })
  return URL.createObjectURL(blob)
}
