import { describe, expect, it } from 'vitest'
import {
  blockMs,
  COMPOSITE_TEMPLATES,
  defaultBlock,
  describe as describeConfig,
  describeBlock,
  ratioInterval,
  ratioLabel,
  stampBlocks,
} from './presets'
import type { CompositeGroupBlock } from './types'

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

describe('set blocks', () => {
  const group: CompositeGroupBlock = {
    id: 'g',
    type: 'group',
    label: 'A',
    sets: 3,
    restBetweenSetsMs: 90_000,
    children: [
      { id: 'c1', type: 'work', label: 'A1', durationMs: 45_000 },
      { id: 'c2', type: 'rest', durationMs: 15_000 },
    ],
  }

  it('describes the block as sets of its contents', () => {
    expect(describeBlock(group)).toBe('A: 3 sets × (A1 0:45 + Rest 0:15)')
  })

  it('adds up sets and the rest between them', () => {
    expect(blockMs(group)).toBe(3 * 60_000 + 2 * 90_000)
    expect(blockMs({ id: 'i', type: 'interval', workMs: 40_000, restMs: 20_000, rounds: 3 })).toBe(
      3 * 40_000 + 2 * 20_000,
    )
  })

  it('defaults to work + rest, three times over', () => {
    expect(defaultBlock('group')).toMatchObject({ type: 'group', sets: 3 })
  })

  it('stamps ids on the children too, so the builder can key them', () => {
    let n = 0
    const [stamped] = stampBlocks([defaultBlock('group')], () => `id-${n++}`)
    expect(stamped.id).toBe('id-0')
    expect((stamped as CompositeGroupBlock).children.map((c) => c.id)).toEqual([
      'id-1',
      'id-2',
    ])
  })
})
