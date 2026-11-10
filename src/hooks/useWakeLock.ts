import { useEffect } from 'react'

interface WakeLockSentinelLike {
  release: () => Promise<void>
}

/**
 * Keeps the phone screen on while a game is running, where the browser allows it. A
 * sleeping phone drops its connection, which would make the player look disconnected
 * during "phones away" games.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } }
    if (!nav.wakeLock) return
    let lock: WakeLockSentinelLike | null = null
    let cancelled = false

    const acquire = () => {
      if (document.visibilityState !== 'visible') return
      nav.wakeLock!.request('screen').then(
        (sentinel) => {
          if (cancelled) void sentinel.release()
          else lock = sentinel
        },
        () => {}, // low battery or not allowed: nothing to do
      )
    }
    acquire()
    // The lock is dropped whenever the tab is hidden, so take it again on return.
    document.addEventListener('visibilitychange', acquire)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', acquire)
      void lock?.release().catch(() => {})
    }
  }, [active])
}
