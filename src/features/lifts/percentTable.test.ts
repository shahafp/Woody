import { describe, expect, it } from 'vitest'
import { buildPercentTable, percentOf, STANDARD_PERCENTS } from './percentTable'

describe('percentTable', () => {
  it('140 kg back squat at 75% is 105 kg', () => {
    expect(percentOf(140, 75)).toBe(105)
  })

  it('builds 100 down to 50 in 5% steps', () => {
    const table = buildPercentTable(100)
    expect(table).toHaveLength(STANDARD_PERCENTS.length)
    expect(table[0]).toEqual({ percent: 100, weightKg: 100 })
    expect(table[table.length - 1]).toEqual({ percent: 50, weightKg: 50 })
  })

  it('supports arbitrary percents', () => {
    expect(buildPercentTable(120, [82.5])[0].weightKg).toBeCloseTo(99, 9)
  })
})
