import { useEffect, useRef, useState } from 'react'

// Minimal types for the Google Identity Services script we load at runtime.
type CredentialResponse = { credential: string }
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(opts: {
            client_id: string
            callback: (r: CredentialResponse) => void
          }): void
          renderButton(el: HTMLElement, opts: Record<string, unknown>): void
        }
      }
    }
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client'
let gsiLoading: Promise<void> | null = null

function loadGsi(): Promise<void> {
  gsiLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      gsiLoading = null
      reject(new Error('Could not load Google sign-in'))
    }
    document.head.appendChild(script)
  })
  return gsiLoading
}

export function GoogleButton({
  clientId,
  onCredential,
}: {
  clientId: string
  onCredential: (credential: string) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  const callback = useRef(onCredential)
  callback.current = onCredential
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadGsi()
      .then(() => {
        if (cancelled || !el.current || !window.google) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (r) => callback.current(r.credential),
        })
        window.google.accounts.id.renderButton(el.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
        })
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [clientId])

  if (failed) return <p className="error">Google sign-in couldn't load. Check your connection and reload.</p>
  return <div ref={el} style={{ minHeight: 44 }} />
}
