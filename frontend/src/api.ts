// Thin fetch wrapper for the /v1 API plus hand-written response types.

export type Me = { id: string; email: string; name: string }
export type PublicConfig = { google_client_id: string }

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
  gift_kind: GiftKind | null
  gift_value: string | null
  gift_note: string | null
  send_mode: SendMode
}

export type Capsule = CapsuleCreate & {
  id: string
  media_kind: 'audio' | 'video' | null
  deliver_at: string
  status: CapsuleStatus
  created_at: string
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const code = typeof body?.detail?.code === 'string' ? body.detail.code : 'UNKNOWN'
    const messages = Array.isArray(body?.detail)
      ? body.detail.map((d: { msg?: string }) => String(d.msg ?? '').replace(/^Value error, /, ''))
      : []
    throw new ApiError(res.status, code, messages)
  }
  return res.status === 204 ? (undefined as T) : res.json()
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
  deliveryPreview: (body: Birthday & { tz: string; send_mode: SendMode }) =>
    request<{ deliver_at: string }>('/v1/delivery-preview', post(body)),
}
