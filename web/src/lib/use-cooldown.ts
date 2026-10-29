import { useCallback, useEffect, useState } from 'react'

/** Seconds left before an action may run again. `start` begins a new wait. */
export function useCooldown(seconds: number, isRunningAtStart = false) {
  const [endsAt, setEndsAt] = useState(() =>
    isRunningAtStart ? Date.now() + seconds * 1000 : null,
  )
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (endsAt === null) return
    const timer = setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= endsAt) setEndsAt(null)
    }, 1000)
    return () => clearInterval(timer)
  }, [endsAt])

  const start = useCallback(() => {
    const current = Date.now()
    setNow(current)
    setEndsAt(current + seconds * 1000)
  }, [seconds])

  const remaining =
    endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000))
  return { remaining, start }
}
