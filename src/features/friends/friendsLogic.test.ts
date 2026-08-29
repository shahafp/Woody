import { describe, expect, it } from 'vitest'
import type { FriendSession } from './friendsTypes'
import {
  addDays,
  dateKey,
  findNearbySessions,
  formatSessionTime,
  groupSessionsByDate,
  planningDates,
  sessionPhase,
  validateSessionDraft,
  zonedDateTimeToIso,
} from './friendsLogic'

function session(id: string, startsAt: string): FriendSession {
  return {
    id,
    groupId: 'group',
    creatorId: 'creator',
    startsAt,
    durationMinutes: 60,
    kind: 'crossfit',
    note: null,
    status: 'scheduled',
    createdAt: startsAt,
    updatedAt: startsAt,
    participants: [],
  }
}

describe('friends date logic', () => {
  it('uses the group date around UTC midnight', () => {
    expect(dateKey(new Date('2026-08-27T21:30:00Z'))).toBe('2026-08-28')
  })

  it('builds a three-day planning window', () => {
    expect(planningDates(new Date('2026-08-27T09:00:00Z'))).toEqual([
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
    ])
  })

  it('adds days across month boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
  })

  it('converts Jerusalem summer wall time to UTC', () => {
    expect(zonedDateTimeToIso('2026-08-27', '17:00')).toBe('2026-08-27T14:00:00.000Z')
    expect(formatSessionTime('2026-08-27T14:00:00Z')).toBe('17:00')
  })

  it('converts Jerusalem winter wall time to UTC', () => {
    expect(zonedDateTimeToIso('2026-12-10', '17:00')).toBe('2026-12-10T15:00:00.000Z')
  })
})

describe('friends session logic', () => {
  it('groups and sorts sessions by group-local date', () => {
    const grouped = groupSessionsByDate([
      session('late', '2026-08-27T16:00:00Z'),
      session('early', '2026-08-27T14:00:00Z'),
      session('tomorrow', '2026-08-28T14:00:00Z'),
    ])
    expect(grouped.get('2026-08-27')?.map((item) => item.id)).toEqual(['early', 'late'])
    expect(grouped.get('2026-08-28')?.map((item) => item.id)).toEqual(['tomorrow'])
  })

  it('suggests sessions within fifteen minutes', () => {
    const sessions = [
      session('near', '2026-08-27T14:15:00Z'),
      session('far', '2026-08-27T14:16:00Z'),
    ]
    expect(findNearbySessions(sessions, '2026-08-27T14:00:00Z').map((item) => item.id)).toEqual([
      'near',
    ])
  })

  it('derives starting, active, and past phases', () => {
    const item = session('one', '2026-08-27T14:00:00Z')
    expect(sessionPhase(item, new Date('2026-08-27T12:00:00Z'))).toBe('upcoming')
    expect(sessionPhase(item, new Date('2026-08-27T13:30:00Z'))).toBe('starting_soon')
    expect(sessionPhase(item, new Date('2026-08-27T14:30:00Z'))).toBe('training_now')
    expect(sessionPhase(item, new Date('2026-08-27T15:00:00Z'))).toBe('past')
  })

  it('validates draft boundaries', () => {
    const errors = validateSessionDraft(
      { date: '2026-09-01', time: '25:80', durationMinutes: 5, kind: 'other', note: 'x'.repeat(241) },
      ['2026-08-27'],
    )
    expect(errors).toEqual({
      date: 'Choose one of the available days.',
      time: 'Enter a valid time.',
      durationMinutes: 'Duration must be between 15 and 360 minutes.',
      note: 'Note must be 240 characters or less.',
    })
  })
})
