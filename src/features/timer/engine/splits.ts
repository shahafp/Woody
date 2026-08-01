import type { CompiledTimer, RoundSplit } from './types'

/** Labels the compiler generates from round numbers — the split shows those anyway. */
function isAutoLabel(label: string, round: number, totalRounds: number): boolean {
  return label === `Work ${round}/${totalRounds}` || label === `Min ${round}/${totalRounds}`
}

/**
 * Round-by-round breakdown of what actually happened: one entry per work
 * segment that started, carrying the rest that followed it.
 *
 * Pure over (compiled timeline, active elapsed) — the same call serves the
 * live run screen, the finish summary, and the log entry, and it stays correct
 * on a session restored after a reload.
 */
export function buildSplits(compiled: CompiledTimer, elapsedMs: number): RoundSplit[] {
  const splits: RoundSplit[] = []
  const segments = compiled.segments
  segments.forEach((seg, i) => {
    if (seg.kind !== 'work' || elapsedMs <= seg.startMs) return
    // An open segment has no real end: it is whatever the clock says so far.
    const ended = seg.open !== true && elapsedMs >= seg.startMs + seg.durationMs
    const next = segments[i + 1]
    const restMs =
      next?.kind === 'rest' && elapsedMs > next.startMs
        ? Math.min(next.durationMs, elapsedMs - next.startMs)
        : undefined
    splits.push({
      index: splits.length + 1,
      ...(isAutoLabel(seg.label, seg.round, seg.totalRounds) ? {} : { label: seg.label }),
      workMs: ended ? seg.durationMs : elapsedMs - seg.startMs,
      ...(restMs === undefined ? {} : { restMs }),
      ...(seg.group ? { group: seg.group } : {}),
      ...(ended ? {} : { partial: true }),
    })
  })
  return splits
}

export interface SplitStats {
  /** Rounds fully completed. */
  rounds: number
  totalWorkMs: number
  totalRestMs: number
  /** Fastest and average completed round; null until one round is in the bank. */
  bestMs: number | null
  averageMs: number | null
}

/** Headline numbers a coach reads first: volume, best round, average round. */
export function splitStats(splits: RoundSplit[]): SplitStats {
  const done = splits.filter((s) => !s.partial)
  const totalWorkMs = splits.reduce((sum, s) => sum + s.workMs, 0)
  const totalRestMs = splits.reduce((sum, s) => sum + (s.restMs ?? 0), 0)
  const doneWorkMs = done.reduce((sum, s) => sum + s.workMs, 0)
  return {
    rounds: done.length,
    totalWorkMs,
    totalRestMs,
    bestMs: done.length ? Math.min(...done.map((s) => s.workMs)) : null,
    averageMs: done.length ? Math.round(doneWorkMs / done.length) : null,
  }
}

/**
 * How this round compares to the one before it — the pacing number.
 * null when either round is incomplete or the two are within a second.
 */
export function splitDeltaMs(splits: RoundSplit[], index: number): number | null {
  const current = splits[index]
  const previous = splits[index - 1]
  if (!current || !previous || current.partial || previous.partial) return null
  const delta = current.workMs - previous.workMs
  return Math.abs(delta) < 1000 ? null : delta
}
