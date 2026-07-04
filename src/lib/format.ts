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

/**
 * Parse "17:42", "1:02:33", or plain seconds ("95") into ms.
 * Returns null when the string isn't a time.
 */
export function parseClock(input: string): number | null {
  const parts = input.trim().split(':')
  if (parts.length > 3 || parts.some((p) => p === '' || !/^\d+$/.test(p))) {
    return null
  }
  const nums = parts.map(Number)
  let seconds = 0
  for (const n of nums) seconds = seconds * 60 + n
  return seconds * 1000
}
