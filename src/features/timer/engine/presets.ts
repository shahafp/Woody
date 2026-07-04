import { formatClock } from '@/lib/format'
import type { TimerConfig, TimerMode } from './types'

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

export const MODE_LABELS: Record<TimerMode, string> = {
  forTime: 'For Time',
  amrap: 'AMRAP',
  emom: 'EMOM',
  interval: 'Intervals',
  custom: 'Custom',
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
    case 'custom': {
      const round = config.steps
        .map((s) => `${formatClock(s.durationMs)} ${s.kind === 'work' ? 'on' : 'off'}`)
        .join(', ')
      return `${config.rounds} × (${round})`
    }
  }
}
