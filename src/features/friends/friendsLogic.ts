import type { FriendSession, SessionDraft } from './friendsTypes'

export const FRIENDS_TIMEZONE = 'Asia/Jerusalem'
export const PLANNING_DAYS = 3
export const NEARBY_SESSION_MS = 15 * 60_000

interface DateParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone)
  if (cached) return cached
  const next = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  formatters.set(timeZone, next)
  return next
}

function zonedParts(date: Date, timeZone: string): DateParts {
  const values = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function dateKey(date: Date, timeZone = FRIENDS_TIMEZONE): string {
  const parts = zonedParts(date, timeZone)
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days, 12))
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

export function planningDates(
  now = new Date(),
  timeZone = FRIENDS_TIMEZONE,
): string[] {
  return planningDatesFromDateKey(dateKey(now, timeZone))
}

export function planningDatesFromDateKey(today: string): string[] {
  return Array.from({ length: PLANNING_DAYS }, (_, index) => addDays(today, index))
}

export function createDefaultSessionDraft(
  allowedDates: string[],
  timeZone = FRIENDS_TIMEZONE,
  now = new Date(),
  preferredDate?: string,
): SessionDraft {
  const suggested = new Date(now.getTime() + 15 * 60_000)
  const suggestedDate = dateKey(suggested, timeZone)
  const date = preferredDate && allowedDates.includes(preferredDate)
    ? preferredDate
    : allowedDates.includes(suggestedDate)
      ? suggestedDate
      : allowedDates[0]

  return {
    date,
    time: formatSessionTime(suggested.toISOString(), timeZone),
    durationMinutes: 60,
    kind: 'crossfit',
    note: '',
  }
}

/** Convert a wall-clock value in an IANA timezone to a UTC instant. */
export function zonedDateTimeToIso(
  date: string,
  time: string,
  timeZone = FRIENDS_TIMEZONE,
): string {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0)
  let guess = desiredAsUtc

  // Offsets can change around DST. Re-evaluating reaches the correct instant
  // without relying on the device timezone.
  for (let pass = 0; pass < 3; pass += 1) {
    const observed = zonedParts(new Date(guess), timeZone)
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    )
    guess += desiredAsUtc - observedAsUtc
  }

  return new Date(guess).toISOString()
}

export function formatSessionTime(
  startsAt: string,
  timeZone = FRIENDS_TIMEZONE,
): string {
  return new Intl.DateTimeFormat('en', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(startsAt))
}

export function formatDateTab(
  date: string,
  today: string,
  timeZone = FRIENDS_TIMEZONE,
): string {
  if (date === today) return 'Today'
  if (date === addDays(today, 1)) return 'Tomorrow'
  const instant = zonedDateTimeToIso(date, '12:00', timeZone)
  return new Intl.DateTimeFormat('en', { timeZone, weekday: 'short' }).format(
    new Date(instant),
  )
}

export function groupSessionsByDate(
  sessions: FriendSession[],
  timeZone = FRIENDS_TIMEZONE,
): Map<string, FriendSession[]> {
  const sorted = [...sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const grouped = new Map<string, FriendSession[]>()
  for (const session of sorted) {
    const key = dateKey(new Date(session.startsAt), timeZone)
    grouped.set(key, [...(grouped.get(key) ?? []), session])
  }
  return grouped
}

export function findNearbySessions(
  sessions: FriendSession[],
  startsAt: string,
  excludeUserId?: string,
): FriendSession[] {
  const target = new Date(startsAt).getTime()
  return sessions.filter((session) => {
    if (session.status !== 'scheduled') return false
    if (excludeUserId && session.participants.some((p) => p.userId === excludeUserId)) {
      return false
    }
    return Math.abs(new Date(session.startsAt).getTime() - target) <= NEARBY_SESSION_MS
  })
}

export type SessionPhase = 'upcoming' | 'starting_soon' | 'training_now' | 'past'

export function sessionPhase(session: FriendSession, now = new Date()): SessionPhase {
  const start = new Date(session.startsAt).getTime()
  const current = now.getTime()
  const end = start + session.durationMinutes * 60_000
  if (current >= end) return 'past'
  if (current >= start) return 'training_now'
  if (start - current <= 60 * 60_000) return 'starting_soon'
  return 'upcoming'
}

export interface SessionDraftErrors {
  date?: string
  time?: string
  durationMinutes?: string
  note?: string
}

export function validateSessionDraft(
  draft: SessionDraft,
  allowedDates: string[],
  timeZone = FRIENDS_TIMEZONE,
  now = new Date(),
): SessionDraftErrors {
  const errors: SessionDraftErrors = {}
  if (!allowedDates.includes(draft.date)) errors.date = 'Choose one of the available days.'
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) errors.time = 'Enter a valid time.'
  if (!errors.date && !errors.time) {
    const startsAt = new Date(zonedDateTimeToIso(draft.date, draft.time, timeZone)).getTime()
    if (startsAt < now.getTime() - 15 * 60_000) {
      errors.time = 'Choose a time that has not passed.'
    }
  }
  if (draft.durationMinutes < 15 || draft.durationMinutes > 360) {
    errors.durationMinutes = 'Duration must be between 15 and 360 minutes.'
  }
  if ([...draft.note.trim()].length > 240) errors.note = 'Note must be 240 characters or less.'
  return errors
}
