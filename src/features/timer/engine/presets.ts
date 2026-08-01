import { formatClock } from '@/lib/format'
import type {
  CompositeBlock,
  CompositeBlockType,
  CompositeGroupBlock,
  CompositeLeafBlock,
  TimerConfig,
  TimerMode,
} from './types'

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never

/** A chipper block before it gets an id — templates and defaults are id-free. */
export type CompositeLeafSpec = DistributiveOmit<CompositeLeafBlock, 'id'>
export type CompositeGroupSpec = Omit<CompositeGroupBlock, 'id' | 'children'> & {
  children: CompositeLeafSpec[]
}
export type CompositeBlockSpec = CompositeLeafSpec | CompositeGroupSpec

const MIN = 60_000
const SEC = 1_000

export function forTime(capMs: number): TimerConfig {
  return { mode: 'forTime', capMs }
}

export function amrap(durationMs: number): TimerConfig {
  return { mode: 'amrap', durationMs }
}

export function emom(rounds: number, intervalSeconds = 60): TimerConfig {
  return { mode: 'emom', intervalMs: intervalSeconds * SEC, rounds }
}

export function interval(
  rounds: number,
  workSeconds: number,
  restSeconds: number,
): TimerConfig {
  return {
    mode: 'interval',
    workMs: workSeconds * SEC,
    restMs: restSeconds * SEC,
    rounds,
  }
}

export function ratioInterval(rounds: number, ratio = 1): TimerConfig {
  return { mode: 'ratioInterval', ratio, rounds }
}

/** work:rest label for a rest ÷ work multiplier. */
export function ratioLabel(ratio: number): string {
  if (ratio === 0.5) return '2:1'
  if (ratio === 2) return '1:2'
  return '1:1'
}

export const MODE_LABELS: Record<TimerMode, string> = {
  forTime: 'For Time',
  amrap: 'AMRAP',
  emom: 'EMOM',
  interval: 'Intervals',
  ratioInterval: '1:1',
  custom: 'Custom',
  composite: 'Custom',
}

/** Short chip summary of a single chipper block. */
export function describeBlock(block: CompositeBlock): string {
  switch (block.type) {
    case 'work':
      return `${block.label ?? 'Work'} ${formatClock(block.durationMs)}`
    case 'rest':
      return `Rest ${formatClock(block.durationMs)}`
    case 'amrap':
      return `AMRAP ${formatClock(block.durationMs)}`
    case 'emom':
      return `EMOM ${block.rounds}×${formatClock(block.intervalMs)}`
    case 'interval':
      return `${block.rounds}×${formatClock(block.workMs)}/${formatClock(block.restMs)}`
    case 'group': {
      const inside = block.children.map(describeBlock).join(' + ')
      const name = block.label ? `${block.label}: ` : ''
      return `${name}${block.sets} sets × (${inside || 'empty'})`
    }
  }
}

/** Clock time a block occupies, sets and inner rests included. */
export function blockMs(block: CompositeBlock): number {
  switch (block.type) {
    case 'work':
    case 'rest':
    case 'amrap':
      return block.durationMs
    case 'emom':
      return block.intervalMs * block.rounds
    case 'interval':
      return block.workMs * block.rounds + block.restMs * Math.max(0, block.rounds - 1)
    case 'group': {
      const set = block.children.reduce((sum, child) => sum + blockMs(child), 0)
      return set * block.sets + block.restBetweenSetsMs * Math.max(0, block.sets - 1)
    }
  }
}

export function describe(config: TimerConfig): string {
  switch (config.mode) {
    case 'forTime':
      return `For time · cap ${formatClock(config.capMs)}`
    case 'amrap':
      return `AMRAP ${formatClock(config.durationMs)}`
    case 'emom':
      return `EMOM ${config.rounds} × ${formatClock(config.intervalMs)}`
    case 'interval':
      return `${config.rounds} × ${formatClock(config.workMs)} on / ${formatClock(config.restMs)} off`
    case 'ratioInterval':
      return `${config.rounds} rounds · rest ${ratioLabel(config.ratio)}`
    case 'custom': {
      const round = config.steps
        .map((s) => `${formatClock(s.durationMs)} ${s.kind === 'work' ? 'on' : 'off'}`)
        .join(', ')
      return `${config.rounds} × (${round})`
    }
    case 'composite':
      return config.blocks.length === 0
        ? 'Empty workout'
        : config.blocks.map(describeBlock).join(' → ')
  }
}

/** A fresh leaf block with sensible starting values — set blocks don't nest. */
export function defaultLeaf(type: Exclude<CompositeBlockType, 'group'>): CompositeLeafSpec {
  switch (type) {
    case 'work':
      return { type: 'work', durationMs: 60 * SEC }
    case 'rest':
      return { type: 'rest', durationMs: 30 * SEC }
    case 'amrap':
      return { type: 'amrap', durationMs: 8 * MIN }
    case 'emom':
      return { type: 'emom', intervalMs: 60 * SEC, rounds: 10 }
    case 'interval':
      return { type: 'interval', workMs: 40 * SEC, restMs: 20 * SEC, rounds: 5 }
  }
}

/** A fresh block of a given type — a set block starts as work + rest, ×3. */
export function defaultBlock(type: CompositeBlockType): CompositeBlockSpec {
  if (type !== 'group') return defaultLeaf(type)
  return {
    type: 'group',
    sets: 3,
    restBetweenSetsMs: 90 * SEC,
    children: [defaultLeaf('work'), defaultLeaf('rest')],
  }
}

/** Attach ids to leaf specs so the builder can key them. */
export function stampLeaves(
  specs: CompositeLeafSpec[],
  makeId: () => string,
): CompositeLeafBlock[] {
  return specs.map((spec) => ({ ...spec, id: makeId() }) as CompositeLeafBlock)
}

/** Attach ids to block specs (templates, defaults), set-block children included. */
export function stampBlocks(
  specs: CompositeBlockSpec[],
  makeId: () => string,
): CompositeBlock[] {
  return specs.map((spec) =>
    spec.type === 'group'
      ? { ...spec, id: makeId(), children: stampLeaves(spec.children, makeId) }
      : ({ ...spec, id: makeId() } as CompositeBlock),
  )
}

/** One-tap starters that show off chaining different block types. */
export const COMPOSITE_TEMPLATES: Array<{ name: string; blocks: CompositeBlockSpec[] }> = [
  {
    name: 'Tabata',
    blocks: [
      { type: 'interval', label: 'Tabata', workMs: 20 * SEC, restMs: 10 * SEC, rounds: 8 },
    ],
  },
  {
    name: 'Buy-in + AMRAP',
    blocks: [
      { type: 'emom', label: 'Buy-in', intervalMs: 60 * SEC, rounds: 5 },
      { type: 'rest', durationMs: 60 * SEC },
      { type: 'amrap', label: 'AMRAP', durationMs: 10 * MIN },
    ],
  },
  {
    name: 'Two Gears',
    blocks: [
      { type: 'interval', label: 'Fast', workMs: 40 * SEC, restMs: 20 * SEC, rounds: 5 },
      { type: 'rest', durationMs: 2 * MIN },
      { type: 'interval', label: 'Grind', workMs: 60 * SEC, restMs: 30 * SEC, rounds: 5 },
    ],
  },
  {
    name: '3 Sets',
    blocks: [
      {
        type: 'group',
        label: 'A',
        sets: 3,
        restBetweenSetsMs: 90 * SEC,
        children: [
          { type: 'work', label: 'A1', durationMs: 45 * SEC },
          { type: 'rest', durationMs: 15 * SEC },
          { type: 'work', label: 'A2', durationMs: 45 * SEC },
        ],
      },
    ],
  },
]
