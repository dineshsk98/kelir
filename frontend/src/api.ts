// Thin fetch wrapper for the /v1 API plus hand-written response types.

export type Me = { id: string; email: string; name: string }
export type PublicConfig = { google_client_id: string }

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
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
    throw new ApiError(res.status, code)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export const api = {
  config: () => request<PublicConfig>('/v1/config'),
  me: () => request<Me>('/v1/me'),
  signInWithGoogle: (credential: string) =>
    request<Me>('/v1/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }),
  signOut: () => request<void>('/v1/auth/logout', { method: 'POST' }),
}
