import { describe, expect, it } from 'vitest'
import { computeSheet, type SheetLiftInfo } from './computeSheet'

const lifts = new Map<string, SheetLiftInfo>([
  ['bs', { name: 'Back Squat', oneRmKg: 140 }],
  ['dl', { name: 'Deadlift', oneRmKg: null }],
])

describe('computeSheet', () => {
  it('computes weights from 1RM and percent', () => {
    const rows = computeSheet(
      [
        { id: '1', liftId: 'bs', sets: 5, reps: 3, percent: 75 },
        { id: '2', liftId: 'bs', sets: 3, reps: 2, percent: 85 },
      ],
      lifts,
    )
    expect(rows[0].weightKg).toBe(105)
    expect(rows[1].weightKg).toBe(119)
    expect(rows[0].liftName).toBe('Back Squat')
  })

  it('flags missing 1RM as null weight', () => {
    const rows = computeSheet([{ id: '1', liftId: 'dl', sets: 3, reps: 5, percent: 70 }], lifts)
    expect(rows[0].weightKg).toBeNull()
  })

  it('handles unknown lifts gracefully', () => {
    const rows = computeSheet([{ id: '1', liftId: 'gone', sets: 1, reps: 1, percent: 100 }], lifts)
    expect(rows[0].liftName).toBe('Unknown lift')
    expect(rows[0].weightKg).toBeNull()
  })
})
