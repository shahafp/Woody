import { describe, expect, it } from 'vitest'
import { describe as describeConfig, ratioInterval, ratioLabel } from './presets'

describe('ratioInterval preset', () => {
  it('builds the config; ratio is rest ÷ work', () => {
    expect(ratioInterval(6, 1)).toEqual({ mode: 'ratioInterval', ratio: 1, rounds: 6 })
    expect(ratioInterval(4, 0.5)).toEqual({ mode: 'ratioInterval', ratio: 0.5, rounds: 4 })
  })

  it('labels ratios as work:rest', () => {
    expect(ratioLabel(0.5)).toBe('2:1')
    expect(ratioLabel(1)).toBe('1:1')
    expect(ratioLabel(2)).toBe('1:2')
  })

  it('describes the workout', () => {
    expect(describeConfig(ratioInterval(6, 2))).toBe('6 rounds · rest 1:2')
  })
})
