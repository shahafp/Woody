import { Fragment } from 'react'
import { formatClock } from '@/lib/format'
import { splitDeltaMs, splitStats } from '../engine/splits'
import type { RoundSplit, SegmentGroup } from '../engine/types'

function groupLabel(group: SegmentGroup): string {
  const name = group.label ? `${group.label} · ` : ''
  return `${name}SET ${group.set}/${group.sets}`
}

function sameGroup(a: SegmentGroup | undefined, b: SegmentGroup | undefined): boolean {
  if (!a || !b) return a === b
  return a.set === b.set && a.sets === b.sets && a.label === b.label
}

/** "+0:04" slower, "−0:04" faster — the only number that tells you to push. */
function Delta({ deltaMs, className }: { deltaMs: number; className?: string }) {
  const slower = deltaMs > 0
  return (
    <span
      className={`text-xs font-semibold ${className ?? (slower ? 'text-alarm' : 'text-work')}`}
    >
      {slower ? '+' : '−'}
      {formatClock(Math.abs(deltaMs))}
    </span>
  )
}

/**
 * Live round times, newest last — glanceable mid-workout so the athlete knows
 * whether they're holding pace or fading.
 */
export function SplitsStrip({ splits }: { splits: RoundSplit[] }) {
  if (splits.length === 0) return null
  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
      {splits.map((split, i) => {
        const latest = i === splits.length - 1
        const delta = splitDeltaMs(splits, i)
        return (
          <span
            key={split.index}
            className={`flex shrink-0 items-baseline gap-1.5 rounded-full px-3 py-1 text-sm ${
              latest ? 'bg-work text-surface' : 'bg-raised text-chalk'
            }`}
          >
            <span className={latest ? 'font-bold' : 'text-chalk-dim'}>{split.index}</span>
            <span className="font-display">{formatClock(split.workMs)}</span>
            {delta !== null && (
              <Delta deltaMs={delta} className={latest ? 'text-surface/80' : undefined} />
            )}
          </span>
        )
      })}
    </div>
  )
}

/** Rounds, best, average — the summary line under a finished session. */
export function SplitsSummary({ splits }: { splits: RoundSplit[] }) {
  const stats = splitStats(splits)
  const cells: Array<[string, string]> = [
    ['rounds', `${stats.rounds}`],
    ['work', formatClock(stats.totalWorkMs)],
  ]
  if (stats.bestMs !== null) cells.push(['best', formatClock(stats.bestMs)])
  if (stats.averageMs !== null) cells.push(['avg', formatClock(stats.averageMs)])
  if (stats.totalRestMs > 0) cells.push(['rest', formatClock(stats.totalRestMs)])
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1">
      {cells.map(([name, value]) => (
        <span key={name} className="flex items-baseline gap-1.5">
          <span className="text-xs uppercase tracking-[0.15em] text-chalk-dim">{name}</span>
          <span className="font-display text-xl text-chalk">{value}</span>
        </span>
      ))}
    </div>
  )
}

/** Round-by-round table: what each round took, and the rest that followed. */
export function SplitsTable({ splits }: { splits: RoundSplit[] }) {
  if (splits.length === 0) return null
  const anyRest = splits.some((s) => s.restMs !== undefined)
  const anyPartial = splits.some((s) => s.partial)
  const anyLabel = splits.some((s) => s.label !== undefined)
  return (
    <div className="flex flex-col">
      <div className="flex items-baseline gap-3 px-2 pb-1 text-xs uppercase tracking-[0.15em] text-chalk-dim">
        <span className="w-6">#</span>
        <span className="flex-1">{anyLabel ? 'block' : ''}</span>
        <span className="w-24 text-right">work</span>
        {anyRest && <span className="w-16 text-right">rest</span>}
      </div>
      {splits.map((split, i) => {
        const previous = splits[i - 1]
        const delta = splitDeltaMs(splits, i)
        return (
          <Fragment key={split.index}>
            {split.group && !sameGroup(split.group, previous?.group) && (
              <span className="mt-2 px-2 text-xs font-semibold uppercase tracking-[0.15em] text-chalk-dim">
                {groupLabel(split.group)}
              </span>
            )}
            <div className="flex items-baseline gap-3 border-b border-edge/60 px-2 py-2 last:border-0">
              <span className="w-6 font-display text-lg text-chalk-dim">{split.index}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-chalk">
                {split.label ?? ''}
                {split.partial && (
                  <span className="ml-1 text-xs text-chalk-dim">· cut short</span>
                )}
              </span>
              <span className="flex w-24 items-baseline justify-end gap-1.5">
                {delta !== null && <Delta deltaMs={delta} />}
                <span className="font-display text-lg text-chalk">
                  {formatClock(split.workMs)}
                </span>
              </span>
              {anyRest && (
                <span className="w-16 text-right font-display text-lg text-rest">
                  {split.restMs === undefined ? '—' : formatClock(split.restMs)}
                </span>
              )}
            </div>
          </Fragment>
        )
      })}
      {anyPartial && (
        <p className="px-2 pt-2 text-xs text-chalk-dim">
          “Cut short” rounds ended with the session, not with the round.
        </p>
      )}
    </div>
  )
}
