import { useRef, useState } from 'react'
import { api, ApiError, type MediaItem, type MediaKind } from '../api'
import { Recorder, type RecordKind } from './Recorder'
import './MediaPicker.css'

export const MAX_ITEMS = 6
const MB = 1024 * 1024
const MAX_BYTES: Record<MediaKind, number> = { image: 15 * MB, audio: 50 * MB, video: 50 * MB }

/** One file in the capsule: previewed locally right away, uploaded in the background. */
export type PickedMedia = {
  key: string
  kind: MediaKind
  name: string
  localUrl: string // object URL of the picked file, for instant previews
  progress: number // 0..1
  status: 'uploading' | 'ready' | 'error'
  error?: string
  uploaded?: MediaItem
  /** Already in the saved capsule (editing): removing it only takes effect on save */
  existing?: boolean
}

/** In-flight uploads by item key, outside React so they outlive this component. */
const runningUploads = new Map<string, AbortController>()

const kindOf = (file: File): MediaKind | null =>
  file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : null

/** Add photos, audio and video files or record them here (up to 6), remove any before saving.
 *  The list lives in the editor so it survives moving between steps. */
export function MediaPicker({
  items,
  onChange,
  photocardKey,
  onPhotocardChange,
}: {
  items: PickedMedia[]
  onChange: (update: (items: PickedMedia[]) => PickedMedia[]) => void
  /** The photo (its key) chosen for the photocard; null = the default picture */
  photocardKey: string | null
  onPhotocardChange: (key: string | null) => void
}) {
  const photoInput = useRef<HTMLInputElement>(null)
  const clipInput = useRef<HTMLInputElement>(null)
  const [recording, setRecording] = useState<RecordKind | null>(null)
  const room = MAX_ITEMS - items.length

  // Uploads keep running when the sender moves to another step (this component unmounts,
  // the editor's list doesn't). Anything left behind unattached is removed after a day.
  const update = (key: string, patch: Partial<PickedMedia>) =>
    onChange((list) => list.map((m) => (m.key === key ? { ...m, ...patch } : m)))

  // Picked files and finished recordings take the same path: check, preview, upload
  const add = (files: File[]) => {
    const picked: PickedMedia[] = []
    for (const file of files.slice(0, room)) {
      const kind = kindOf(file)
      const item: PickedMedia = {
        key: crypto.randomUUID(),
        kind: kind ?? 'image',
        name: file.name,
        localUrl: URL.createObjectURL(file),
        progress: 0,
        status: 'uploading',
      }
      if (!kind) {
        picked.push({ ...item, status: 'error', error: "This file type isn't supported" })
        continue
      }
      if (file.size > MAX_BYTES[kind]) {
        picked.push({ ...item, status: 'error', error: `Too large (limit ${MAX_BYTES[kind] / MB} MB)` })
        continue
      }
      picked.push(item)
      const controller = new AbortController()
      runningUploads.set(item.key, controller)
      api
        .uploadFile(file, (p) => update(item.key, { progress: p }), controller.signal)
        .then((uploaded) => update(item.key, { status: 'ready', progress: 1, uploaded }))
        .catch((e) => {
          if (e instanceof ApiError && e.code === 'ABORTED') return
          const message = e instanceof ApiError && e.messages[0] ? e.messages[0] : "Couldn't upload this file"
          update(item.key, { status: 'error', error: message })
        })
        .finally(() => runningUploads.delete(item.key))
    }
    onChange((list) => [...list, ...picked])
  }

  const remove = (item: PickedMedia) => {
    runningUploads.get(item.key)?.abort()
    if (!item.existing) {
      // A new upload nobody needs: discard it now (leftovers are also cleaned up after a day)
      if (item.uploaded) api.discardUpload(item.uploaded.id).catch(() => {})
      URL.revokeObjectURL(item.localUrl)
    }
    onChange((list) => list.filter((m) => m.key !== item.key))
    if (item.key === photocardKey) onPhotocardChange(null) // its photo is gone: back to the default
  }

  const photos = items.filter((m) => m.kind === 'image' && m.status === 'ready')

  return (
    <div className="media-picker">
      {items.length > 0 && (
        <ul className="media-tiles">
          {items.map((m) => (
            <li key={m.key} className={`media-tile media-${m.status}`}>
              {m.kind === 'image' && m.status !== 'error' && <img src={m.localUrl} alt="" />}
              {m.kind === 'video' && m.status !== 'error' && <video src={m.localUrl} muted playsInline preload="metadata" />}
              {(m.kind === 'audio' || m.status === 'error') && (
                <span className="media-tile-icon" aria-hidden="true">
                  {m.status === 'error' ? '⚠️' : '🎵'}
                </span>
              )}
              <span className="media-tile-name">{m.status === 'error' ? m.error : m.name}</span>
              {m.status === 'uploading' && (
                <span
                  className="media-progress"
                  role="progressbar"
                  aria-label={`Uploading ${m.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(m.progress * 100)}
                >
                  <span style={{ width: `${Math.round(m.progress * 100)}%` }} />
                </span>
              )}
              <button type="button" className="media-remove" aria-label={`Remove ${m.name}`} onClick={() => remove(m)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {photos.length > 0 && (
        <fieldset className="photocard-picker">
          <legend>Put one of your photos on their photocard?</legend>
          <div className="photocard-options">
            <label className="photocard-option">
              <input type="radio" name="photocard" checked={photocardKey === null} onChange={() => onPhotocardChange(null)} />
              <span className="photocard-thumb photocard-default">Default card</span>
            </label>
            {photos.map((m) => (
              <label key={m.key} className="photocard-option">
                <input
                  type="radio"
                  name="photocard"
                  checked={photocardKey === m.key}
                  onChange={() => onPhotocardChange(m.key)}
                />
                <span className="photocard-thumb">
                  <img src={m.localUrl} alt={m.name} />
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {room > 0 && recording && (
        <Recorder
          kind={recording}
          onUse={(file) => {
            add([file])
            setRecording(null)
          }}
          onClose={() => setRecording(null)}
        />
      )}
      {room > 0 && !recording && (
        <div className="media-add">
          <button type="button" className="btn btn-soft" onClick={() => setRecording('video')}>
            🎥 Record video
          </button>
          <button type="button" className="btn btn-soft" onClick={() => setRecording('audio')}>
            🎙️ Record voice
          </button>
          <button type="button" className="btn btn-soft" onClick={() => photoInput.current?.click()}>
            📷 Add photos
          </button>
          <button type="button" className="btn btn-soft" onClick={() => clipInput.current?.click()}>
            🎬 Add video or audio
          </button>
          <span className="small muted">{room} of {MAX_ITEMS} left</span>
        </div>
      )}
      <input
        ref={photoInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        onChange={(e) => {
          add(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />
      <input
        ref={clipInput}
        type="file"
        accept="video/*,audio/*"
        multiple
        hidden
        onChange={(e) => {
          add(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />
    </div>
  )
}
