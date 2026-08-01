import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { formatClock, parseClock, parseCount } from '@/lib/format'
import { newId } from '@/lib/ids'
import {
  blockMs,
  COMPOSITE_TEMPLATES,
  defaultBlock,
  defaultLeaf,
  describeBlock,
  stampBlocks,
  stampLeaves,
} from '../engine/presets'
import type {
  CompositeBlock,
  CompositeBlockType,
  CompositeGroupBlock,
  CompositeLeafBlock,
} from '../engine/types'
import { CompactStepper } from './CompactStepper'

const SEC = 1000
const clampDur = (s: number, lo = 5, hi = 3600) => Math.min(hi, Math.max(lo, s))
const clampRounds = (r: number) => Math.min(99, Math.max(1, r))

/** Typed seconds: bare digits read as seconds, "1:30" reads as written. */
const editSeconds =
  (apply: (seconds: number) => void, lo = 5) =>
  (text: string) => {
    const ms = parseClock(text)
    if (ms !== null) apply(clampDur(Math.round(ms / SEC), lo))
  }

const editRounds = (apply: (rounds: number) => void) => (text: string) => {
  const n = parseCount(text)
  if (n !== null) apply(clampRounds(n))
}

type LeafType = Exclude<CompositeBlockType, 'group'>

const LEAF_TYPES: LeafType[] = ['work', 'rest', 'amrap', 'emom', 'interval']
const ADD_TYPES: CompositeBlockType[] = [...LEAF_TYPES, 'group']
const TYPE_LABEL: Record<CompositeBlockType, string> = {
  work: 'Work',
  rest: 'Rest',
  amrap: 'AMRAP',
  emom: 'EMOM',
  interval: 'Interval',
  group: 'Sets',
}

/** Reorder / remove / label controls shared by every card. */
function BlockControls({
  index,
  count,
  onMove,
  onRemove,
}: {
  index: number
  count: number
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  return (
    <div className="ml-auto flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label="Move up"
        disabled={index === 0}
        onClick={() => onMove(-1)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-chalk-dim active:bg-edge disabled:opacity-25"
      >
        <ChevronUp size={18} />
      </button>
      <button
        type="button"
        aria-label="Move down"
        disabled={index === count - 1}
        onClick={() => onMove(1)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-chalk-dim active:bg-edge disabled:opacity-25"
      >
        <ChevronDown size={18} />
      </button>
      <button
        type="button"
        aria-label="Remove block"
        onClick={onRemove}
        className="flex h-8 w-8 items-center justify-center rounded-full text-chalk-dim active:text-alarm"
      >
        <X size={18} />
      </button>
    </div>
  )
}

/** The −/+ and typable fields for one leaf block. */
function LeafFields({
  block,
  replace,
}: {
  block: CompositeLeafBlock
  replace: (next: CompositeLeafBlock) => void
}) {
  if (block.type === 'work' || block.type === 'rest' || block.type === 'amrap') {
    const stepSec = block.type === 'amrap' ? 60 : 5
    const setSeconds = (seconds: number) => replace({ ...block, durationMs: seconds * SEC })
    return (
      <CompactStepper
        label={block.type === 'amrap' ? 'Duration' : 'Time'}
        display={formatClock(block.durationMs)}
        onDecrement={() => setSeconds(clampDur(block.durationMs / SEC - stepSec))}
        onIncrement={() => setSeconds(clampDur(block.durationMs / SEC + stepSec))}
        onEdit={editSeconds(setSeconds)}
      />
    )
  }

  if (block.type === 'emom') {
    const setSeconds = (seconds: number) => replace({ ...block, intervalMs: seconds * SEC })
    const setRounds = (rounds: number) => replace({ ...block, rounds })
    return (
      <>
        <CompactStepper
          label="Every"
          display={formatClock(block.intervalMs)}
          onDecrement={() => setSeconds(clampDur(block.intervalMs / SEC - 15))}
          onIncrement={() => setSeconds(clampDur(block.intervalMs / SEC + 15))}
          onEdit={editSeconds(setSeconds)}
        />
        <CompactStepper
          label="Rounds"
          display={`${block.rounds}`}
          onDecrement={() => setRounds(clampRounds(block.rounds - 1))}
          onIncrement={() => setRounds(clampRounds(block.rounds + 1))}
          onEdit={editRounds(setRounds)}
        />
      </>
    )
  }

  const setWork = (seconds: number) => replace({ ...block, workMs: seconds * SEC })
  const setRest = (seconds: number) => replace({ ...block, restMs: seconds * SEC })
  const setRounds = (rounds: number) => replace({ ...block, rounds })
  return (
    <>
      <CompactStepper
        label="Work"
        display={formatClock(block.workMs)}
        onDecrement={() => setWork(clampDur(block.workMs / SEC - 5))}
        onIncrement={() => setWork(clampDur(block.workMs / SEC + 5))}
        onEdit={editSeconds(setWork)}
      />
      <CompactStepper
        label="Rest"
        display={formatClock(block.restMs)}
        onDecrement={() => setRest(clampDur(block.restMs / SEC - 5))}
        onIncrement={() => setRest(clampDur(block.restMs / SEC + 5))}
        onEdit={editSeconds(setRest)}
      />
      <CompactStepper
        label="Rounds"
        display={`${block.rounds}`}
        onDecrement={() => setRounds(clampRounds(block.rounds - 1))}
        onIncrement={() => setRounds(clampRounds(block.rounds + 1))}
        onEdit={editRounds(setRounds)}
      />
    </>
  )
}

function LeafCard({
  block,
  index,
  count,
  replace,
  remove,
  move,
  nested = false,
}: {
  block: CompositeLeafBlock
  index: number
  count: number
  replace: (next: CompositeLeafBlock) => void
  remove: () => void
  move: (dir: -1 | 1) => void
  nested?: boolean
}) {
  return (
    <div className={`flex flex-col gap-3 rounded-2xl p-3 ${nested ? 'bg-edge/50' : 'bg-raised'}`}>
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
            onChange={(e) => replace({ ...block, label: e.target.value || undefined })}
            placeholder="Movement (optional)"
            className="min-w-0 flex-1 rounded-lg bg-edge px-3 py-1.5 text-sm text-chalk outline-none placeholder:text-chalk-dim"
          />
        )}
        <BlockControls index={index} count={count} onMove={move} onRemove={remove} />
      </div>
      <LeafFields block={block} replace={replace} />
    </div>
  )
}

/**
 * A set block: a little chain of its own, repeated for sets. This is how a
 * trainer actually writes a session — "3 sets of: 45s push, 15s breathe,
 * 45s pull, then 90s off" — instead of pasting the same blocks three times.
 */
function GroupCard({
  block,
  index,
  count,
  replace,
  remove,
  move,
}: {
  block: CompositeGroupBlock
  index: number
  count: number
  replace: (next: CompositeGroupBlock) => void
  remove: () => void
  move: (dir: -1 | 1) => void
}) {
  const children = block.children
  const setChildren = (next: CompositeLeafBlock[]) => replace({ ...block, children: next })
  const setSets = (sets: number) => replace({ ...block, sets })
  const setRestSeconds = (seconds: number) =>
    replace({ ...block, restBetweenSetsMs: seconds * SEC })
  const perSetMs = children.reduce((sum, child) => sum + blockMs(child), 0)

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-work/40 bg-raised p-3">
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded-lg bg-chalk px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-surface">
          {TYPE_LABEL.group}
        </span>
        <input
          value={block.label ?? ''}
          onChange={(e) => replace({ ...block, label: e.target.value || undefined })}
          placeholder="Block name (optional)"
          className="min-w-0 flex-1 rounded-lg bg-edge px-3 py-1.5 text-sm text-chalk outline-none placeholder:text-chalk-dim"
        />
        <BlockControls index={index} count={count} onMove={move} onRemove={remove} />
      </div>

      <CompactStepper
        label="Sets"
        display={`${block.sets}`}
        onDecrement={() => setSets(clampRounds(block.sets - 1))}
        onIncrement={() => setSets(clampRounds(block.sets + 1))}
        onEdit={editRounds(setSets)}
      />
      <CompactStepper
        label="Between sets"
        display={
          block.restBetweenSetsMs === 0 ? 'none' : formatClock(block.restBetweenSetsMs)
        }
        onDecrement={() =>
          setRestSeconds(clampDur(block.restBetweenSetsMs / SEC - 15, 0))
        }
        onIncrement={() =>
          setRestSeconds(clampDur(block.restBetweenSetsMs / SEC + 15, 0))
        }
        onEdit={editSeconds(setRestSeconds, 0)}
      />

      <span className="text-xs font-semibold uppercase tracking-[0.15em] text-chalk-dim">
        Each set · {formatClock(perSetMs)}
      </span>

      {children.length === 0 && (
        <p className="rounded-xl border border-dashed border-edge p-4 text-center text-sm text-chalk-dim">
          Add the timeframes that make up one set.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {children.map((child, i) => (
          <LeafCard
            key={child.id}
            block={child}
            index={i}
            count={children.length}
            nested
            replace={(next) => setChildren(children.map((c, j) => (j === i ? next : c)))}
            remove={() => setChildren(children.filter((_, j) => j !== i))}
            move={(dir) => {
              const j = i + dir
              if (j < 0 || j >= children.length) return
              const next = [...children]
              ;[next[i], next[j]] = [next[j], next[i]]
              setChildren(next)
            }}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {LEAF_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setChildren([...children, ...stampLeaves([defaultLeaf(type)], newId)])}
            className="rounded-xl border border-edge py-2 text-xs font-semibold text-chalk-dim active:bg-edge"
          >
            + {TYPE_LABEL[type]}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Chipper builder: an ordered chain of named, heterogeneous blocks that run
 * back-to-back, any of which can be a set block that repeats. Editing is fully
 * controlled — every change hands a fresh blocks array to the parent.
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
        <div key={block.id} className="flex flex-col gap-1">
          {block.type === 'group' ? (
            <GroupCard
              block={block}
              index={i}
              count={blocks.length}
              replace={(next) => replace(i, next)}
              remove={() => remove(i)}
              move={(dir) => move(i, dir)}
            />
          ) : (
            <LeafCard
              block={block}
              index={i}
              count={blocks.length}
              replace={(next) => replace(i, next)}
              remove={() => remove(i)}
              move={(dir) => move(i, dir)}
            />
          )}
          <span className="px-3 text-xs text-chalk-dim">
            {describeBlock(block)} · {formatClock(blockMs(block))}
          </span>
        </div>
      ))}

      <div className="grid grid-cols-3 gap-2">
        {ADD_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => add(type)}
            className={`rounded-xl border py-2.5 text-sm font-semibold active:bg-raised ${
              type === 'group'
                ? 'border-work/60 text-chalk'
                : 'border-edge text-chalk-dim'
            }`}
          >
            + {TYPE_LABEL[type]}
          </button>
        ))}
      </div>
    </div>
  )
}
