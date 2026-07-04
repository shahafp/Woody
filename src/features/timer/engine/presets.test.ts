import { describe, expect, it } from 'vitest'
import {
  COMPOSITE_TEMPLATES,
  defaultBlock,
  describe as describeConfig,
  describeBlock,
  ratioInterval,
  ratioLabel,
  stampBlocks,
} from './presets'

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

describe('composite helpers', () => {
  it('describes a chipper as an arrow-joined chain', () => {
    expect(
      describeConfig({
        mode: 'composite',
        blocks: [
          { id: 'a', type: 'emom', label: 'Buy-in', intervalMs: 60_000, rounds: 5 },
          { id: 'b', type: 'rest', durationMs: 60_000 },
          { id: 'c', type: 'amrap', durationMs: 10 * 60_000 },
        ],
      }),
    ).toBe('EMOM 5×1:00 → Rest 1:00 → AMRAP 10:00')
  })

  it('describes an empty chipper', () => {
    expect(describeConfig({ mode: 'composite', blocks: [] })).toBe('Empty workout')
  })

  it('describeBlock uses the movement label for work blocks', () => {
    expect(describeBlock({ id: 'x', type: 'work', label: 'Thrusters', durationMs: 45_000 })).toBe(
      'Thrusters 0:45',
    )
    expect(describeBlock({ id: 'x', type: 'interval', workMs: 40_000, restMs: 20_000, rounds: 5 })).toBe(
      '5×0:40/0:20',
    )
  })

  it('defaultBlock yields a valid spec per type', () => {
    expect(defaultBlock('emom')).toMatchObject({ type: 'emom', intervalMs: 60_000, rounds: 10 })
    expect(defaultBlock('interval')).toMatchObject({ type: 'interval', rounds: 5 })
  })

  it('stampBlocks attaches ids without mutating the specs', () => {
    let n = 0
    const [spec] = COMPOSITE_TEMPLATES[0].blocks
    const stamped = stampBlocks(COMPOSITE_TEMPLATES[0].blocks, () => `id-${n++}`)
    expect(stamped[0]).toMatchObject({ ...spec, id: 'id-0' })
    expect(spec).not.toHaveProperty('id')
  })
})
