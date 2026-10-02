import fixWebmDuration from 'fix-webm-duration'
import { useCallback, useEffect, useRef, useState } from 'react'
import './Recorder.css'

export type RecordKind = 'audio' | 'video'

export const RECORD_LIMIT_S: Record<RecordKind, number> = { audio: 120, video: 60 }

// Chrome and Firefox record WebM, Safari records MP4: use the first one this browser can make
const TYPES: Record<RecordKind, string[]> = {
  video: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'],
  audio: ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'],
}

const CONSTRAINTS: Record<RecordKind, MediaStreamConstraints> = {
  audio: { audio: true },
  video: { audio: true, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } },
}

type Stage =
  | { name: 'asking' }
  | { name: 'live' } // camera/mic on, not recording yet
  | { name: 'recording'; startedAt: number }
  | { name: 'review'; file: File; url: string }
  | { name: 'problem'; message: string; canRetry: boolean }

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

function problemFrom(error: unknown, kind: RecordKind): Stage {
  const device = kind === 'video' ? 'camera' : 'microphone'
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return {
      name: 'problem',
      message: `Your browser is blocking the ${device}. Allow it in the site settings (next to the address bar), then try again.`,
      canRetry: true,
    }
  if (name === 'NotFoundError' || name === 'OverconstrainedError')
    return { name: 'problem', message: `No ${device} was found on this device.`, canRetry: true }
  if (name === 'NotReadableError')
    return { name: 'problem', message: `The ${device} is busy in another app. Close it there, then try again.`, canRetry: true }
  return { name: 'problem', message: `Recording didn't start. Please try again.`, canRetry: true }
}

/** Record a voice note (up to 2 min) or a video (up to 1 min), play it back, redo it, and
 *  hand the finished file to `onUse`. The camera and microphone are on only while needed. */
export function Recorder({
  kind,
  onUse,
  onClose,
}: {
  kind: RecordKind
  onUse: (file: File) => void
  onClose: () => void
}) {
  const [stage, setStage] = useState<Stage>({ name: 'asking' })
  const [elapsed, setElapsed] = useState(0)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const liveVideo = useRef<HTMLVideoElement>(null)
  const meter = useRef<HTMLSpanElement>(null)
  const limit = RECORD_LIMIT_S[kind]

  const stopDevices = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const openDevices = useCallback(async () => {
    // Browsers only allow the camera and microphone on https or localhost
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setStage({
        name: 'problem',
        message: 'Recording isn\'t available here (it needs a secure https page). You can add a file instead.',
        canRetry: false,
      })
      return
    }
    setStage({ name: 'asking' })
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia(CONSTRAINTS[kind])
      setStage({ name: 'live' })
    } catch (e) {
      setStage(problemFrom(e, kind))
    }
  }, [kind])

  // Open the devices when the recorder appears; release everything when it goes away
  useEffect(() => {
    void openDevices()
    return () => {
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null // leaving mid-recording discards it
        recorder.stop()
      }
      stopDevices()
    }
  }, [openDevices, stopDevices])

  // Show the camera while framing and recording
  useEffect(() => {
    if (liveVideo.current && (stage.name === 'live' || stage.name === 'recording'))
      liveVideo.current.srcObject = streamRef.current
  }, [stage.name])

  // Microphone level, so you can see your voice is being picked up
  useEffect(() => {
    const stream = streamRef.current
    if (!stream || (stage.name !== 'live' && stage.name !== 'recording')) return
    const audio = new AudioContext()
    const analyser = audio.createAnalyser()
    analyser.fftSize = 512
    audio.createMediaStreamSource(stream).connect(analyser)
    const samples = new Uint8Array(analyser.fftSize)
    let frame = 0
    const draw = () => {
      analyser.getByteTimeDomainData(samples)
      let peak = 0
      for (const s of samples) peak = Math.max(peak, Math.abs(s - 128))
      if (meter.current) meter.current.style.transform = `scaleX(${Math.min(1, (peak / 128) * 1.6)})`
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(frame)
      void audio.close()
    }
  }, [stage.name])

  // The review URL belongs to this stage only
  useEffect(() => {
    if (stage.name !== 'review') return
    const url = stage.url
    return () => URL.revokeObjectURL(url)
  }, [stage])

  const start = () => {
    const stream = streamRef.current
    if (!stream) return
    const mimeType = TYPES[kind].find((t) => MediaRecorder.isTypeSupported(t))
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 })
    } catch (e) {
      setStage(problemFrom(e, kind))
      return
    }
    const chunks: Blob[] = []
    const startedAt = performance.now()
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)
    recorder.onstop = async () => {
      const durationMs = performance.now() - startedAt
      stopDevices()
      const type = recorder.mimeType || mimeType || chunks[0]?.type || `${kind}/webm`
      let blob = new Blob(chunks, { type })
      // A WebM recorded in pieces has no length in its header, so players show an unknown
      // duration; write the measured one in (a no-op when the browser already did)
      if (type.includes('webm')) blob = await fixWebmDuration(blob, durationMs, { logger: false })
      const extension = type.includes('mp4') ? 'mp4' : 'webm'
      const file = new File([blob], `${kind === 'video' ? 'Video' : 'Voice'} recording.${extension}`, { type })
      setStage({ name: 'review', file, url: URL.createObjectURL(file) })
    }
    // No timeslice: the whole recording arrives at the end, and Chrome then writes its length itself
    recorder.start()
    recorderRef.current = recorder
    setElapsed(0)
    setStage({ name: 'recording', startedAt })
  }

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }, [])

  // Running clock, and an automatic stop at the length limit
  useEffect(() => {
    if (stage.name !== 'recording') return
    const timer = setInterval(() => {
      const seconds = (performance.now() - stage.startedAt) / 1000
      setElapsed(Math.min(seconds, limit))
      if (seconds >= limit) stop()
    }, 200)
    return () => clearInterval(timer)
  }, [stage, limit, stop])

  const live = stage.name === 'live' || stage.name === 'recording'

  return (
    <section className="recorder" aria-label={kind === 'video' ? 'Record a video' : 'Record your voice'}>
      {stage.name === 'asking' && (
        <p className="recorder-note muted">Waiting for your {kind === 'video' ? 'camera' : 'microphone'}…</p>
      )}

      {live && kind === 'video' && <video ref={liveVideo} className="recorder-live" autoPlay muted playsInline />}
      {live && kind === 'audio' && <p className="recorder-mic" aria-hidden="true">🎙️</p>}
      {live && (
        <span className="recorder-meter" aria-hidden="true">
          <span ref={meter} />
        </span>
      )}

      {stage.name === 'recording' && (
        <p className="recorder-clock" role="timer" aria-live="off">
          <span className="recorder-dot" aria-hidden="true" /> {clock(elapsed)} / {clock(limit)}
        </p>
      )}

      {stage.name === 'review' &&
        (kind === 'video' ? (
          <video className="recorder-playback" src={stage.url} controls playsInline />
        ) : (
          <audio className="recorder-playback" src={stage.url} controls />
        ))}

      {stage.name === 'problem' && (
        <p className="recorder-note error" role="alert">
          {stage.message}
        </p>
      )}

      <div className="recorder-actions">
        {stage.name === 'live' && (
          <button type="button" className="btn" onClick={start}>
            ● Start recording
          </button>
        )}
        {stage.name === 'recording' && (
          <button type="button" className="btn" onClick={stop}>
            ■ Stop
          </button>
        )}
        {stage.name === 'review' && (
          <>
            <button type="button" className="btn" onClick={() => onUse(stage.file)}>
              Use this
            </button>
            <button type="button" className="btn btn-soft" onClick={() => void openDevices()}>
              Redo
            </button>
          </>
        )}
        {stage.name === 'problem' && stage.canRetry && (
          <button type="button" className="btn btn-soft" onClick={() => void openDevices()}>
            Try again
          </button>
        )}
        <button type="button" className="btn btn-quiet" onClick={onClose}>
          {stage.name === 'review' ? 'Discard' : 'Cancel'}
        </button>
      </div>
    </section>
  )
}
