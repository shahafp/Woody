import { describe, expect, it } from 'vitest'
import {
  formatClock,
  formatCountdown,
  maskClock,
  parseClock,
  parseCount,
} from './format'

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

describe('maskClock', () => {
  it('fills the clock from the right as digits arrive', () => {
    expect(maskClock('')).toBe('')
    expect(maskClock('3')).toBe('0:03')
    expect(maskClock('32')).toBe('0:32')
    expect(maskClock('320')).toBe('3:20')
    expect(maskClock('1230')).toBe('12:30')
    expect(maskClock('12345')).toBe('1:23:45')
    expect(maskClock('123456')).toBe('12:34:56')
  })

  it('re-masks its own output, so typing and backspacing stay stable', () => {
    expect(maskClock('3:20')).toBe('3:20')
    expect(maskClock('3:2')).toBe('0:32') // backspace over the last digit
    expect(maskClock('0:03')).toBe('0:03')
  })

  it('ignores anything that is not a digit and keeps the last six', () => {
    expect(maskClock('a1b3c0')).toBe('1:30')
    expect(maskClock('1234567')).toBe('23:45:67')
  })

  it('round trips a formatted clock', () => {
    expect(maskClock(formatClock(450_000))).toBe('7:30')
    expect(maskClock(formatClock(720_000))).toBe('12:00')
  })
})

describe('parseCount', () => {
  it('takes whole numbers only', () => {
    expect(parseCount('12')).toBe(12)
    expect(parseCount(' 3 ')).toBe(3)
    expect(parseCount('3.5')).toBeNull()
    expect(parseCount('')).toBeNull()
  })
})
