import { describe, expect, it } from 'vitest'
import type { WodSheetBlock } from '@/lib/db/types'
import {
  blockMovements,
  generateWave,
  mirrorLegacy,
  setsAreUniform,
  uniformSets,
} from './blockModel'

describe('generateWave', () => {
  it('climbs per set and per wave (base 70 / +5 / 3 / 2 waves)', () => {
    const sets = generateWave({ basePercent: 70, step: 5, setsPerWave: 3, waves: 2, reps: 3 })
    expect(sets.map((s) => s.percent)).toEqual([70, 75, 80, 75, 80, 85])
    expect(sets.every((s) => s.reps === 3)).toBe(true)
  })

  it('a single flat wave with step 0 is just uniform sets', () => {
    const sets = generateWave({ basePercent: 75, step: 0, setsPerWave: 5, waves: 1, reps: 3 })
    expect(sets).toEqual(uniformSets(5, 3, 75))
  })
})

describe('setsAreUniform', () => {
  it('true for identical sets, false when a percent or rep differs', () => {
    expect(setsAreUniform(uniformSets(3, 5, 70))).toBe(true)
    expect(setsAreUniform([{ reps: 5, percent: 70 }, { reps: 5, percent: 75 }])).toBe(false)
    expect(setsAreUniform([{ reps: 5, percent: 70 }, { reps: 3, percent: 70 }])).toBe(false)
    expect(setsAreUniform([])).toBe(true)
  })
})

describe('blockMovements', () => {
  it('synthesizes one movement from a legacy block', () => {
    const block: WodSheetBlock = { id: 'b1', liftId: 'bs', sets: 3, reps: 5, percent: 70 }
    const movements = blockMovements(block)
    expect(movements).toHaveLength(1)
    expect(movements[0]).toMatchObject({ id: 'b1', liftId: 'bs' })
    expect(movements[0].sets).toEqual(uniformSets(3, 5, 70))
  })

  it('returns stored movements when present', () => {
    const block: WodSheetBlock = {
      id: 'b1', liftId: 'bs', sets: 0, reps: 0, percent: 0,
      movements: [
        { id: 'm1', liftId: 'bs', sets: [{ reps: 3, percent: 70 }] },
        { id: 'm2', liftId: 'pu', sets: [{ reps: 8, percent: 0 }] },
      ],
    }
    expect(blockMovements(block)).toHaveLength(2)
  })
})

describe('mirrorLegacy', () => {
  it('summarizes the primary movement for old clients', () => {
    expect(
      mirrorLegacy([
        { id: 'm1', liftId: 'bs', sets: [{ reps: 3, percent: 70 }, { reps: 3, percent: 75 }] },
      ]),
    ).toEqual({ liftId: 'bs', sets: 2, reps: 3, percent: 70 })
  })
})
