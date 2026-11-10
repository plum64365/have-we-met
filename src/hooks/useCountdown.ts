import { useEffect, useState } from 'react'

/** Whole seconds left until an ISO deadline (0 once it has passed, null with no deadline). */
export function useCountdown(deadline: string | undefined | null): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!deadline) return
    setNow(Date.now())
    const tick = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(tick)
  }, [deadline])
  if (!deadline) return null
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000))
}
