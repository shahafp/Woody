import type { CompiledTimer, Cue, Segment, TimerConfig } from './types'

export const DEFAULT_PREP_MS = 10_000

/** Safety cap for an open work segment — ends an abandoned session eventually. */
export const OPEN_CAP_MS = 4 * 60 * 60_000

/**
 * Compiles any timer config to a flat segment sequence with cues attached.
 * Named modes are presets over the same model; custom is the general case.
 */
export function compile(
  config: TimerConfig,
  prepMs = DEFAULT_PREP_MS,
  lapOffsetsMs: number[] = [],
): CompiledTimer {
  const segments: Segment[] = []
  let cursor = 0

  const push = (
    kind: Segment['kind'],
    label: string,
    durationMs: number,
    round: number,
    totalRounds: number,
    open = false,
  ) => {
    segments.push({
      index: segments.length,
      kind,
      label,
      startMs: cursor,
      durationMs,
      round,
      totalRounds,
      ...(open ? { open: true } : {}),
    })
    cursor += durationMs
  }

  if (prepMs > 0) push('prep', 'Get ready', prepMs, 0, 0)

  switch (config.mode) {
    case 'forTime':
      push('work', 'For time', config.capMs, 1, 1)
      break
    case 'amrap':
      push('work', 'AMRAP', config.durationMs, 1, 1)
      break
    case 'emom':
      for (let r = 1; r <= config.rounds; r++) {
        push('work', `Min ${r}/${config.rounds}`, config.intervalMs, r, config.rounds)
      }
      break
    case 'interval':
      for (let r = 1; r <= config.rounds; r++) {
        push('work', `Work ${r}/${config.rounds}`, config.workMs, r, config.rounds)
        // No trailing rest: the workout ends on the last work segment.
        if (r < config.rounds) {
          push('rest', `Rest ${r}/${config.rounds}`, config.restMs, r, config.rounds)
        }
      }
      break
    case 'ratioInterval': {
      const laps = lapOffsetsMs.slice(0, config.rounds)
      laps.forEach((lapMs, i) => {
        const r = i + 1
        const workMs = Math.max(0, lapMs - cursor)
        push('work', `Work ${r}/${config.rounds}`, workMs, r, config.rounds)
        if (r < config.rounds) {
          push('rest', `Rest ${r}/${config.rounds}`, Math.round(workMs * config.ratio), r, config.rounds)
        }
      })
      if (laps.length < config.rounds) {
        const r = laps.length + 1
        push('work', `Work ${r}/${config.rounds}`, OPEN_CAP_MS, r, config.rounds, true)
      }
      break
    }
    case 'custom':
      for (let r = 1; r <= config.rounds; r++) {
        config.steps.forEach((step, i) => {
          const isTrailingRest =
            step.kind === 'rest' &&
            r === config.rounds &&
            i === config.steps.length - 1
          if (isTrailingRest) return
          const fallback =
            step.kind === 'work'
              ? `Work ${r}/${config.rounds}`
              : `Rest ${r}/${config.rounds}`
          push(step.kind, step.label ?? fallback, step.durationMs, r, config.rounds)
        })
      }
      break
    case 'composite':
      // Blocks run back-to-back; a rest *between* blocks is its own rest block.
      for (const block of config.blocks) {
        switch (block.type) {
          case 'work':
            push('work', block.label ?? 'Work', block.durationMs, 1, 1)
            break
          case 'rest':
            push('rest', block.label ?? 'Rest', block.durationMs, 1, 1)
            break
          case 'amrap':
            push('work', block.label ?? 'AMRAP', block.durationMs, 1, 1)
            break
          case 'emom':
            for (let r = 1; r <= block.rounds; r++) {
              const base = block.label ?? 'EMOM'
              push('work', `${base} ${r}/${block.rounds}`, block.intervalMs, r, block.rounds)
            }
            break
          case 'interval':
            for (let r = 1; r <= block.rounds; r++) {
              const base = block.label ?? 'Work'
              push('work', `${base} ${r}/${block.rounds}`, block.workMs, r, block.rounds)
              // No trailing rest: the block ends on its last work segment.
              if (r < block.rounds) {
                push('rest', `Rest ${r}/${block.rounds}`, block.restMs, r, block.rounds)
              }
            }
            break
        }
      }
      break
  }

  return {
    config,
    segments,
    cues: buildCues(segments, cursor, config.mode === 'ratioInterval'),
    display: config.mode === 'forTime' ? 'up' : 'down',
    totalMs: cursor,
  }
}

function buildCues(segments: Segment[], totalMs: number, dynamicWork: boolean): Cue[] {
  const cues: Cue[] = []
  for (const seg of segments) {
    const end = seg.startMs + seg.durationMs
    // 3-2-1 ticks announcing whatever comes at this segment's end.
    // Skipped for dynamic work segments: an open end is unknown, and a
    // closed one is always already in the past.
    const skipTicks = seg.open === true || (dynamicWork && seg.kind === 'work')
    if (seg.durationMs >= 4000 && !skipTicks) {
      for (const back of [3000, 2000, 1000]) {
        cues.push({ atMs: end - back, sound: 'tick' })
      }
    }
    if (seg.kind === 'work') {
      cues.push({ atMs: seg.startMs, sound: 'go', vibrate: [200] })
    } else if (seg.kind === 'rest' && !dynamicWork) {
      // Dynamic rests start at the lap tap, which plays the cue imperatively.
      cues.push({ atMs: seg.startMs, sound: 'transition', vibrate: [100, 80, 100] })
    }
  }
  cues.push({ atMs: totalMs, sound: 'finish', vibrate: [600, 150, 600] })

  const seen = new Set<string>()
  return cues
    .filter((c) => {
      const key = `${c.atMs}:${c.sound}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.atMs - b.atMs)
}
