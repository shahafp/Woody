import { Minus, Plus } from 'lucide-react'

/** Labeled row with −/+ controls: "Work   − 0:40 +". */
export function CompactStepper({
  label,
  display,
  onDecrement,
  onIncrement,
}: {
  label: string
  display: string
  onDecrement: () => void
  onIncrement: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold uppercase tracking-[0.15em] text-chalk-dim">
        {label}
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Less ${label}`}
          onClick={onDecrement}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-raised text-chalk active:bg-edge"
        >
          <Minus size={20} />
        </button>
        <span className="w-20 text-center font-display text-3xl text-chalk">
          {display}
        </span>
        <button
          type="button"
          aria-label={`More ${label}`}
          onClick={onIncrement}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-raised text-chalk active:bg-edge"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  )
}

export function ChipRow<T extends number>({
  values,
  selected,
  format,
  onSelect,
}: {
  values: T[]
  selected: number
  format: (v: T) => string
  onSelect: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onSelect(v)}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
            v === selected
              ? 'bg-work text-surface'
              : 'bg-raised text-chalk-dim active:bg-edge'
          }`}
        >
          {format(v)}
        </button>
      ))}
    </div>
  )
}
