// Thin fetch wrapper for the /v1 API plus hand-written response types.

import type { MessageLang } from './languages'

export type Me = { id: string; email: string; name: string }
export type PublicConfig = { google_client_id: string; demo_mode: boolean }

export type Feb29Pref = 'FEB_28' | 'MAR_1'
export type SendMode = 'birthday' | 'now'
export type GiftKind = 'link' | 'code'
export type CapsuleStatus = 'scheduled' | 'delivered' | 'opened' | 'cancelled'

export type Birthday = {
  birth_month: number
  birth_day: number
  feb29_pref: Feb29Pref | null
}

export type CapsuleCreate = Birthday & {
  recipient_name: string
  recipient_email: string
  city_label: string
  tz: string
  message_text: string | null
  message_lang: MessageLang
  gift_kind: GiftKind | null
  gift_value: string | null
  gift_note: string | null
  send_mode: SendMode
  /** Uploaded photos/audio/video, in order */
  upload_ids: string[]
}

export type MediaKind = 'image' | 'audio' | 'video'
export type MediaItem = { id: string; kind: MediaKind; mime: string; size_bytes: number }

export type Capsule = Omit<CapsuleCreate, 'upload_ids'> & {
  id: string
  media: MediaItem[]
  deliver_at: string
  status: CapsuleStatus
  delivery_trouble: boolean
  opened_at: string | null
  reply: Reply | null
  created_at: string
}

export type Reply = { text: string; created_at: string }
export type ReplyPreset = { key: string; text: string }

/** What the recipient's private link returns */
export type RecipientCapsule = {
  sender_name: string
  recipient_name: string
  message_text: string | null
  message_lang: MessageLang
  media: MediaItem[]
  gift_kind: GiftKind | null
  gift_value: string | null
  gift_note: string | null
  reply: Reply | null
  reply_presets: ReplyPreset[]
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    /** Human-readable validation messages from a 422, if any */
    public messages: string[] = [],
  ) {
    super(`${status} ${code}`)
  }
}

function errorFrom(status: number, body: unknown): ApiError {
  const detail = (body as { detail?: unknown } | null)?.detail
  const code =
    detail && typeof detail === 'object' && 'code' in detail && typeof detail.code === 'string'
      ? detail.code
      : 'UNKNOWN'
  const messages = Array.isArray(detail)
    ? detail.map((d: { msg?: string }) => String(d.msg ?? '').replace(/^Value error, /, ''))
    : []
  return new ApiError(status, code, messages)
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
  if (!res.ok) throw errorFrom(res.status, await res.json().catch(() => ({})))
  return res.status === 204 ? (undefined as T) : res.json()
}

/** Upload one file with progress (fetch can't report upload progress; XHR can). */
function uploadFile(file: File, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<MediaItem> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/v1/uploads')
    xhr.withCredentials = true
    xhr.responseType = 'json'
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onload = () =>
      xhr.status === 201 ? resolve(xhr.response as MediaItem) : reject(errorFrom(xhr.status, xhr.response))
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK'))
    xhr.onabort = () => reject(new ApiError(0, 'ABORTED'))
    signal?.addEventListener('abort', () => xhr.abort())
    const form = new FormData()
    form.append('file', file)
    xhr.send(form)
  })
}

/** Where a media item can be fetched: the sender's own preview, or through a capsule link */
export const mediaUrl = {
  own: (id: string) => `/v1/uploads/${encodeURIComponent(id)}`,
  viaLink: (secret: string, id: string) =>
    `/v1/c/${encodeURIComponent(secret)}/media/${encodeURIComponent(id)}`,
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

export const api = {
  config: () => request<PublicConfig>('/v1/config'),
  me: () => request<Me>('/v1/me'),
  signInWithGoogle: (credential: string) => request<Me>('/v1/auth/google', post({ credential })),
  signOut: () => request<void>('/v1/auth/logout', { method: 'POST' }),

  emailCheck: (email: string) =>
    request<{ valid_format: boolean; accepts_mail: boolean | null }>('/v1/email-check', post({ email })),
  listCapsules: () => request<Capsule[]>('/v1/capsules'),
  createCapsule: (body: CapsuleCreate) => request<Capsule>('/v1/capsules', post(body)),
  getCapsule: (id: string) => request<Capsule>(`/v1/capsules/${encodeURIComponent(id)}`),
  updateCapsule: (id: string, body: CapsuleCreate) =>
    request<Capsule>(`/v1/capsules/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  cancelCapsule: (id: string) => request<Capsule>(`/v1/capsules/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  deliveryPreview: (body: Birthday & { tz: string; send_mode: SendMode }) =>
    request<{ deliver_at: string }>('/v1/delivery-preview', post(body)),
  uploadFile,
  discardUpload: (id: string) => request<void>(`/v1/uploads/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  simulateMidnight: (id: string) =>
    request<Capsule>(`/v1/demo/capsules/${encodeURIComponent(id)}/simulate-midnight`, { method: 'POST' }),

  openCapsule: (secret: string) => request<RecipientCapsule>(`/v1/c/${encodeURIComponent(secret)}`),
  sendReply: (secret: string, body: { preset_key: string } | { text: string }) =>
    request<Reply>(`/v1/c/${encodeURIComponent(secret)}/reply`, post(body)),
}
