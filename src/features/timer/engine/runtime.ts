import type {
  CompiledTimer,
  Cue,
  Segment,
  TimerEvent,
  TimerPhase,
  TimerView,
} from './types'

/**
 * Active (unpaused) milliseconds derived from the event log.
 * No accumulation — always a fold over wall-clock timestamps, so the result
 * is correct after any gap: background suspension, phone call, page reload.
 */
export function activeElapsed(events: TimerEvent[], now: number): number {
  let elapsed = 0
  let runningSince: number | null = null
  for (const e of events) {
    if (e.type === 'lap') continue
    if (e.type === 'start' || e.type === 'resume') {
      if (runningSince === null) runningSince = e.at
    } else if (runningSince !== null) {
      elapsed += e.at - runningSince
      runningSince = null
    }
  }
  if (runningSince !== null) elapsed += Math.max(0, now - runningSince)
  return elapsed
}

export function isPaused(events: TimerEvent[]): boolean {
  return events[events.length - 1]?.type === 'pause'
}

/**
 * Active-time offsets (same domain as Segment.startMs) of each lap event.
 * Pause-aware by construction: the same fold as activeElapsed, sampled at
 * each lap.
 */
export function lapOffsets(events: TimerEvent[]): number[] {
  const offsets: number[] = []
  let elapsed = 0
  let runningSince: number | null = null
  for (const e of events) {
    if (e.type === 'lap') {
      offsets.push(elapsed + (runningSince !== null ? e.at - runningSince : 0))
    } else if (e.type === 'start' || e.type === 'resume') {
      if (runningSince === null) runningSince = e.at
    } else if (runningSince !== null) {
      elapsed += e.at - runningSince
      runningSince = null
    }
  }
  return offsets
}

export function segmentAt(
  compiled: CompiledTimer,
  elapsedMs: number,
): Segment | null {
  const segs = compiled.segments
  if (segs.length === 0) return null
  let lo = 0
  let hi = segs.length - 1
  let ans = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (segs[mid].startMs <= elapsedMs) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return segs[ans]
}

export function computeView(
  compiled: CompiledTimer,
  events: TimerEvent[],
  now: number,
): TimerView {
  const prepMs =
    compiled.segments[0]?.kind === 'prep' ? compiled.segments[0].durationMs : 0

  if (events.length === 0) {
    return {
      phase: 'idle',
      segment: null,
      segmentElapsedMs: 0,
      segmentRemainingMs: 0,
      elapsedActiveMs: 0,
      workElapsedMs: 0,
      totalRemainingMs: compiled.totalMs,
      round: 0,
      totalRounds: 0,
      finishedWorkMs: null,
    }
  }

  const finished = events.some((e) => e.type === 'finish')
  const rawElapsed = activeElapsed(events, now)
  const elapsed = Math.min(rawElapsed, compiled.totalMs)
  const done = finished || rawElapsed >= compiled.totalMs

  const segment = segmentAt(compiled, Math.min(elapsed, compiled.totalMs - 1))
  const segmentElapsedMs = segment ? elapsed - segment.startMs : 0
  const segmentRemainingMs = segment
    ? Math.max(0, segment.durationMs - segmentElapsedMs)
    : 0
  const workElapsedMs = Math.max(0, elapsed - prepMs)

  const phase: TimerPhase = done
    ? 'done'
    : isPaused(events)
      ? 'paused'
      : segment?.kind === 'prep'
        ? 'prep'
        : 'running'

  return {
    phase,
    segment,
    segmentElapsedMs,
    segmentRemainingMs,
    elapsedActiveMs: elapsed,
    workElapsedMs,
    totalRemainingMs: Math.max(0, compiled.totalMs - elapsed),
    round: segment?.round ?? 0,
    totalRounds: segment?.totalRounds ?? 0,
    finishedWorkMs: done ? workElapsedMs : null,
  }
}

/** Cues with atMs in (fromMs, toMs] — active-time domain. */
export function cuesInWindow(
  compiled: CompiledTimer,
  fromMs: number,
  toMs: number,
): Cue[] {
  return compiled.cues.filter((c) => c.atMs > fromMs && c.atMs <= toMs)
}
