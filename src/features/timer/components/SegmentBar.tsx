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
