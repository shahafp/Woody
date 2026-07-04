import { Minus, Plus } from 'lucide-react'

export function MinutePicker({
  label,
  minutes,
  chips,
  onChange,
}: {
  label: string
  minutes: number
  chips: number[]
  onChange: (minutes: number) => void
}) {
  const clamp = (v: number) => Math.min(90, Math.max(1, v))
  return (
    <div className="flex flex-col items-center gap-5">
      <span className="text-sm font-semibold uppercase tracking-[0.2em] text-chalk-dim">
        {label}
      </span>
      <div className="flex items-center gap-6">
        <button
          type="button"
          aria-label="One minute less"
          onClick={() => onChange(clamp(minutes - 1))}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-raised text-chalk active:bg-edge"
        >
          <Minus size={26} />
        </button>
        <span className="font-display text-7xl text-chalk">
          {minutes}
          <span className="ml-1 text-3xl text-chalk-dim">min</span>
        </span>
        <button
          type="button"
          aria-label="One minute more"
          onClick={() => onChange(clamp(minutes + 1))}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-raised text-chalk active:bg-edge"
        >
          <Plus size={26} />
        </button>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              c === minutes
                ? 'bg-work text-surface'
                : 'bg-raised text-chalk-dim active:bg-edge'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  )
}
