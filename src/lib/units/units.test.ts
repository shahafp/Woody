import { describe, expect, it } from 'vitest'
import { fromDisplayUnit, kgToLbs, lbsToKg, toDisplayUnit } from './convert'
import { roundToPlate } from './plates'

describe('convert', () => {
  it('kg <-> lbs round trips', () => {
    expect(kgToLbs(100)).toBeCloseTo(220.462, 2)
    expect(lbsToKg(225)).toBeCloseTo(102.058, 2)
    expect(lbsToKg(kgToLbs(87.5))).toBeCloseTo(87.5, 9)
  })

  it('display helpers', () => {
    expect(toDisplayUnit(100, 'kg')).toBe(100)
    expect(toDisplayUnit(100, 'lbs')).toBeCloseTo(220.462, 2)
    expect(fromDisplayUnit(225, 'lbs')).toBeCloseTo(102.058, 2)
  })
})

describe('roundToPlate', () => {
  it('rounds kg to 2.5 by default increments', () => {
    expect(roundToPlate(105, 'kg', 2.5, 5)).toBe(105)
    expect(roundToPlate(103.9, 'kg', 2.5, 5)).toBe(105)
    expect(roundToPlate(103.7, 'kg', 2.5, 5)).toBe(102.5)
    expect(roundToPlate(101.24, 'kg', 2.5, 5)).toBe(100)
  })

  it('supports 1.25 kg jumps', () => {
    expect(roundToPlate(103.9, 'kg', 1.25, 5)).toBe(103.75)
  })

  it('rounds in lbs space for lbs users', () => {
    // 100 kg = 220.46 lbs -> nearest 5 lbs = 220
    expect(roundToPlate(100, 'lbs', 2.5, 5)).toBe(220)
    // 102.06 kg = 225.02 lbs -> 225
    expect(roundToPlate(102.06, 'lbs', 2.5, 5)).toBe(225)
  })

  it('half rounds up', () => {
    expect(roundToPlate(101.25, 'kg', 2.5, 5)).toBe(102.5)
  })
})
