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

/**
 * Typed entry for a minutes field: "12" → 12:00, "7.5" → 7:30, "7:30" → 7:30.
 * A bare number reads as minutes here (the field is labelled in minutes),
 * which keeps a numeric phone keypad enough to fill it in.
 */
export function parseMinutes(input: string): number | null {
  const text = input.trim()
  if (text === '') return null
  if (text.includes(':')) return parseClock(text)
  if (!/^\d+(\.\d+)?$/.test(text)) return null
  return Math.round(Number(text) * 60_000)
}

/** Typed entry for a whole-number field (rounds, sets). */
export function parseCount(input: string): number | null {
  const text = input.trim()
  if (!/^\d+$/.test(text)) return null
  return Number(text)
}
