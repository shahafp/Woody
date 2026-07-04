function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

/** "M:SS" (or "H:MM:SS"), flooring — for count-up displays. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/**
 * Countdown display, ceiling — matches a gym wall timer: a 10:00 AMRAP shows
 * 10:00 at the start and hits 0:00 exactly at the buzzer.
 */
export function formatCountdown(ms: number): string {
  return formatClock(Math.ceil(Math.max(0, ms) / 1000) * 1000)
}
