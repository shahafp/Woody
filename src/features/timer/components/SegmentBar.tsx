import type { CompiledTimer } from '../engine/types'

const FILL: Record<string, string> = {
  prep: 'bg-chalk-dim',
  work: 'bg-work',
  rest: 'bg-rest',
}

/** Proportional segment strip showing position in the whole workout. */
export function SegmentBar({
  compiled,
  elapsedMs,
}: {
  compiled: CompiledTimer
  elapsedMs: number
}) {
  if (compiled.config.mode === 'ratioInterval') {
    return (
      <RatioSlotBar
        rounds={compiled.config.rounds}
        compiled={compiled}
        elapsedMs={elapsedMs}
      />
    )
  }
  // prep + a single work block has nothing to show
  if (compiled.segments.length <= 2) return null
  return (
    <div className="flex h-1.5 w-full gap-[2px]">
      {compiled.segments.map((s) => {
        const fill = Math.min(1, Math.max(0, (elapsedMs - s.startMs) / s.durationMs))
        return (
          <div
            key={s.index}
            style={{ flexGrow: s.durationMs }}
            className="relative overflow-hidden rounded-full bg-edge"
          >
            <div
              className={`absolute inset-y-0 left-0 ${FILL[s.kind]}`}
              style={{ width: `${fill * 100}%` }}
            />
          </div>
        )
      })}
    </div>
  )
}

/**
 * Durations are unknown up front, so slots are equal-width: done → full,
 * current rest → live fraction, current open work → pulsing full fill.
 */
function RatioSlotBar({
  rounds,
  compiled,
  elapsedMs,
}: {
  rounds: number
  compiled: CompiledTimer
  elapsedMs: number
}) {
  if (rounds <= 1) return null
  const placed = compiled.segments.filter((s) => s.kind !== 'prep')
  return (
    <div className="flex h-1.5 w-full gap-[2px]">
      {Array.from({ length: 2 * rounds - 1 }, (_, i) => {
        const kind = i % 2 === 0 ? 'work' : 'rest'
        const seg = placed[i]
        let fill = 0
        let pulse = false
        if (seg) {
          if (seg.open) {
            const active = elapsedMs >= seg.startMs
            fill = active ? 1 : 0
            pulse = active
          } else {
            fill = Math.min(1, Math.max(0, (elapsedMs - seg.startMs) / seg.durationMs))
          }
        }
        return (
          <div key={i} className="relative flex-1 overflow-hidden rounded-full bg-edge">
            <div
              className={`absolute inset-y-0 left-0 ${FILL[kind]} ${pulse ? 'animate-pulse' : ''}`}
              style={{ width: `${fill * 100}%` }}
            />
          </div>
        )
      })}
    </div>
  )
}
