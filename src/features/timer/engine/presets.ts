import { formatClock } from '@/lib/format'
import type {
  CompositeBlock,
  CompositeBlockType,
  TimerConfig,
  TimerMode,
} from './types'

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never

/** A chipper block before it gets an id — templates and defaults are id-free. */
export type CompositeBlockSpec = DistributiveOmit<CompositeBlock, 'id'>

const MIN = 60_000
const SEC = 1_000

export function forTime(capMinutes: number): TimerConfig {
  return { mode: 'forTime', capMs: capMinutes * MIN }
}

export function amrap(minutes: number): TimerConfig {
  return { mode: 'amrap', durationMs: minutes * MIN }
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

/** A fresh block of a given type with sensible starting values. */
export function defaultBlock(type: CompositeBlockType): CompositeBlockSpec {
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

/** Attach ids to block specs (templates, defaults) so the builder can key them. */
export function stampBlocks(
  specs: CompositeBlockSpec[],
  makeId: () => string,
): CompositeBlock[] {
  return specs.map((spec) => ({ ...spec, id: makeId() }) as CompositeBlock)
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
]
