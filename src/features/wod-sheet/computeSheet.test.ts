import { describe, expect, it } from 'vitest'
import type { WodSheetBlock } from '@/lib/db/types'
import { computeSheet, type SheetLiftInfo } from './computeSheet'

const lifts = new Map<string, SheetLiftInfo>([
  ['bs', { name: 'Back Squat', oneRmKg: 140 }],
  ['pp', { name: 'Push Press', oneRmKg: 80 }],
  ['dl', { name: 'Deadlift', oneRmKg: null }],
])

const legacy = (over: Partial<WodSheetBlock>): WodSheetBlock => ({
  id: '1', liftId: 'bs', sets: 5, reps: 3, percent: 75, ...over,
})

describe('computeSheet', () => {
  it('computes a legacy block as one uniform movement', () => {
    const [row] = computeSheet([legacy({})], lifts)
    expect(row.isSuperset).toBe(false)
    expect(row.movements[0].name).toBe('Back Squat')
    expect(row.movements[0].uniform).toBe(true)
    expect(row.movements[0].sets).toHaveLength(5)
    expect(row.movements[0].sets[0].weightKg).toBe(105)
  })

  it('computes a wave as per-set weights and flags it non-uniform', () => {
    const [row] = computeSheet(
      [
        legacy({
          movements: [
            {
              id: 'm1', liftId: 'bs',
              sets: [
                { reps: 3, percent: 70 },
                { reps: 3, percent: 75 },
                { reps: 3, percent: 80 },
              ],
            },
          ],
        }),
      ],
      lifts,
    )
    const mv = row.movements[0]
    expect(mv.uniform).toBe(false)
    expect(mv.sets.map((s) => s.weightKg)).toEqual([98, 105, 112])
  })

  it('computes a superset: each movement off its own 1RM', () => {
    const [row] = computeSheet(
      [
        legacy({
          label: 'A',
          movements: [
            { id: 'm1', liftId: 'bs', sets: [{ reps: 3, percent: 75 }] },
            { id: 'm2', liftId: 'pp', sets: [{ reps: 5, percent: 70 }] },
          ],
        }),
      ],
      lifts,
    )
    expect(row.isSuperset).toBe(true)
    expect(row.label).toBe('A')
    expect(row.movements[0].sets[0].weightKg).toBe(105)
    expect(row.movements[1].name).toBe('Push Press')
    expect(row.movements[1].sets[0].weightKg).toBe(56)
  })

  it('uses the movement label for a complex; percent still off the lift 1RM', () => {
    const [row] = computeSheet(
      [
        legacy({
          movements: [
            { id: 'm1', liftId: 'bs', label: 'Clean + FS + Jerk', sets: [{ reps: 1, percent: 80 }] },
          ],
        }),
      ],
      lifts,
    )
    expect(row.movements[0].name).toBe('Clean + FS + Jerk')
    expect(row.movements[0].sets[0].weightKg).toBe(112)
  })

  it('passes through tempo and note, trimming blanks to null', () => {
    const [row] = computeSheet([legacy({ tempo: '31X1', note: '  ' })], lifts)
    expect(row.tempo).toBe('31X1')
    expect(row.note).toBeNull()
  })

  it('flags missing 1RM as null weight', () => {
    const [row] = computeSheet([legacy({ liftId: 'dl' })], lifts)
    expect(row.movements[0].sets[0].weightKg).toBeNull()
  })

  it('handles unknown lifts gracefully', () => {
    const [row] = computeSheet([legacy({ liftId: 'gone' })], lifts)
    expect(row.movements[0].name).toBe('Unknown lift')
    expect(row.movements[0].sets[0].weightKg).toBeNull()
  })
})
