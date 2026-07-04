import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { formatClock } from '@/lib/format'
import { newId } from '@/lib/ids'
import {
  COMPOSITE_TEMPLATES,
  defaultBlock,
  stampBlocks,
} from '../engine/presets'
import type { CompositeBlock, CompositeBlockType } from '../engine/types'
import { CompactStepper } from './CompactStepper'

const SEC = 1000
const clampDur = (s: number, lo = 5, hi = 3600) => Math.min(hi, Math.max(lo, s))
const clampRounds = (r: number) => Math.min(99, Math.max(1, r))

const ADD_TYPES: CompositeBlockType[] = ['work', 'rest', 'amrap', 'emom', 'interval']
const TYPE_LABEL: Record<CompositeBlockType, string> = {
  work: 'Work',
  rest: 'Rest',
  amrap: 'AMRAP',
  emom: 'EMOM',
  interval: 'Interval',
}

/**
 * Chipper builder: an ordered chain of named, heterogeneous blocks that run
 * back-to-back. Editing is fully controlled — every change hands a fresh
 * blocks array to the parent.
 */
export function CompositeBuilder({
  blocks,
  onChange,
}: {
  blocks: CompositeBlock[]
  onChange: (blocks: CompositeBlock[]) => void
}) {
  const replace = (i: number, next: CompositeBlock) =>
    onChange(blocks.map((b, j) => (j === i ? next : b)))
  const remove = (i: number) => onChange(blocks.filter((_, j) => j !== i))
  const add = (type: CompositeBlockType) =>
    onChange([...blocks, ...stampBlocks([defaultBlock(type)], newId)])
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= blocks.length) return
    const next = [...blocks]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <span className="self-center text-xs font-semibold uppercase tracking-[0.15em] text-chalk-dim">
          Templates
        </span>
        {COMPOSITE_TEMPLATES.map((tpl) => (
          <button
            key={tpl.name}
            type="button"
            onClick={() => onChange(stampBlocks(tpl.blocks, newId))}
            className="rounded-full bg-raised px-3 py-1.5 text-sm font-semibold text-chalk active:bg-edge"
          >
            {tpl.name}
          </button>
        ))}
      </div>

      {blocks.length === 0 && (
        <p className="rounded-2xl border border-dashed border-edge p-5 text-center text-sm text-chalk-dim">
          Add blocks to build your workout — they run one after another.
        </p>
      )}

      {blocks.map((block, i) => (
        <div key={block.id} className="flex flex-col gap-3 rounded-2xl bg-raised p-3">
          <div className="flex items-center gap-2">
            <span
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide ${
                block.type === 'rest' ? 'bg-rest text-surface' : 'bg-work text-surface'
              }`}
            >
              {TYPE_LABEL[block.type]}
            </span>
            {block.type !== 'rest' && (
              <input
                value={block.label ?? ''}
                onChange={(e) =>
                  replace(i, { ...block, label: e.target.value || undefined })
                }
                placeholder="Movement (optional)"
                className="min-w-0 flex-1 rounded-lg bg-edge px-3 py-1.5 text-sm text-chalk outline-none placeholder:text-chalk-dim"
              />
            )}
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label="Move up"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-chalk-dim active:bg-edge disabled:opacity-25"
              >
                <ChevronUp size={18} />
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={i === blocks.length - 1}
                onClick={() => move(i, 1)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-chalk-dim active:bg-edge disabled:opacity-25"
              >
                <ChevronDown size={18} />
              </button>
              <button
                type="button"
                aria-label="Remove block"
                onClick={() => remove(i)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-chalk-dim active:text-alarm"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {(block.type === 'work' || block.type === 'rest' || block.type === 'amrap') && (
            <CompactStepper
              label={block.type === 'amrap' ? 'Duration' : 'Time'}
              display={formatClock(block.durationMs)}
              onDecrement={() =>
                replace(i, {
                  ...block,
                  durationMs: clampDur(block.durationMs / SEC - (block.type === 'amrap' ? 60 : 5)) * SEC,
                })
              }
              onIncrement={() =>
                replace(i, {
                  ...block,
                  durationMs: clampDur(block.durationMs / SEC + (block.type === 'amrap' ? 60 : 5)) * SEC,
                })
              }
            />
          )}

          {block.type === 'emom' && (
            <>
              <CompactStepper
                label="Every"
                display={formatClock(block.intervalMs)}
                onDecrement={() =>
                  replace(i, { ...block, intervalMs: clampDur(block.intervalMs / SEC - 15) * SEC })
                }
                onIncrement={() =>
                  replace(i, { ...block, intervalMs: clampDur(block.intervalMs / SEC + 15) * SEC })
                }
              />
              <CompactStepper
                label="Rounds"
                display={`${block.rounds}`}
                onDecrement={() => replace(i, { ...block, rounds: clampRounds(block.rounds - 1) })}
                onIncrement={() => replace(i, { ...block, rounds: clampRounds(block.rounds + 1) })}
              />
            </>
          )}

          {block.type === 'interval' && (
            <>
              <CompactStepper
                label="Work"
                display={formatClock(block.workMs)}
                onDecrement={() =>
                  replace(i, { ...block, workMs: clampDur(block.workMs / SEC - 5) * SEC })
                }
                onIncrement={() =>
                  replace(i, { ...block, workMs: clampDur(block.workMs / SEC + 5) * SEC })
                }
              />
              <CompactStepper
                label="Rest"
                display={formatClock(block.restMs)}
                onDecrement={() =>
                  replace(i, { ...block, restMs: clampDur(block.restMs / SEC - 5) * SEC })
                }
                onIncrement={() =>
                  replace(i, { ...block, restMs: clampDur(block.restMs / SEC + 5) * SEC })
                }
              />
              <CompactStepper
                label="Rounds"
                display={`${block.rounds}`}
                onDecrement={() => replace(i, { ...block, rounds: clampRounds(block.rounds - 1) })}
                onIncrement={() => replace(i, { ...block, rounds: clampRounds(block.rounds + 1) })}
              />
            </>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        {ADD_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => add(type)}
            className="flex-1 whitespace-nowrap rounded-xl border border-edge py-2.5 text-sm font-semibold text-chalk-dim active:bg-raised"
          >
            + {TYPE_LABEL[type]}
          </button>
        ))}
      </div>
    </div>
  )
}
