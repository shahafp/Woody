import { describe, expect, it } from 'vitest'
import { formatClock, formatCountdown, parseClock } from './format'

describe('formatClock', () => {
  it('floors to the started second', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(999)).toBe('0:00')
    expect(formatClock(61_000)).toBe('1:01')
    expect(formatClock(3_599_000)).toBe('59:59')
    expect(formatClock(3_600_000)).toBe('1:00:00')
  })

  it('clamps negatives', () => {
    expect(formatClock(-5000)).toBe('0:00')
  })
})

describe('formatCountdown', () => {
  it('ceils like a gym wall timer', () => {
    expect(formatCountdown(600_000)).toBe('10:00')
    expect(formatCountdown(599_500)).toBe('10:00')
    expect(formatCountdown(599_000)).toBe('9:59')
    expect(formatCountdown(500)).toBe('0:01')
    expect(formatCountdown(0)).toBe('0:00')
  })
})

describe('parseClock', () => {
  it('parses mm:ss, h:mm:ss, and bare seconds', () => {
    expect(parseClock('17:42')).toBe(1_062_000)
    expect(parseClock('1:02:33')).toBe(3_753_000)
    expect(parseClock('95')).toBe(95_000)
    expect(parseClock(' 5:00 ')).toBe(300_000)
  })

  it('rejects junk', () => {
    expect(parseClock('')).toBeNull()
    expect(parseClock('abc')).toBeNull()
    expect(parseClock('1:2:3:4')).toBeNull()
    expect(parseClock('12:')).toBeNull()
    expect(parseClock('-5')).toBeNull()
  })

  it('round trips with formatClock', () => {
    expect(formatClock(parseClock('17:42')!)).toBe('17:42')
  })
})
