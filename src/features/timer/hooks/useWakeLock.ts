import { useEffect } from 'react'

export const wakeLockSupported =
  typeof navigator !== 'undefined' && 'wakeLock' in navigator

/**
 * Holds a screen wake lock while `active`. Locks auto-release when the page
 * is hidden, so we re-request on every return to visibility.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !wakeLockSupported) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const request = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void lock.release().catch(() => {})
        } else {
          sentinel = lock
        }
      } catch {
        // denied (e.g. low battery mode) — the setup screen shows a hint instead
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void request()
    }

    void request()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release().catch(() => {})
    }
  }, [active])
}
