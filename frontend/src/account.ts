import { useEffect } from 'react'
import { api, ApiError, type Me } from './api'

/** Sent when a tab comes back and the same account is still signed in: pages refresh their
 *  lists on this, never on plain focus (which once refetched another account's capsules
 *  under the old header, devpost/learnings.md). */
export const ACCOUNT_CONFIRMED = 'capsule:account-confirmed'

/**
 * Sign-in belongs to the browser, not the tab: one cookie for every tab. So whenever this tab
 * comes back into view, ask who's signed in. Another account → reload into it (nothing of
 * the old one stays on screen); nobody → `onSignedOut`; the same → ACCOUNT_CONFIRMED.
 */
export function useAccountWatch(me: Me | null | undefined, onSignedOut: () => void) {
  useEffect(() => {
    if (!me) return
    let checking = false
    const check = async () => {
      if (document.visibilityState !== 'visible' || checking) return
      checking = true
      try {
        const now = await api.me().catch((e) => (e instanceof ApiError && e.status === 401 ? null : undefined))
        if (now === undefined) return // the server didn't answer: leave the page as it is
        if (now === null) onSignedOut()
        else if (now.id !== me.id) window.location.reload()
        else window.dispatchEvent(new Event(ACCOUNT_CONFIRMED))
      } finally {
        checking = false
      }
    }
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [me, onSignedOut])
}
