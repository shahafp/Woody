import { Minus, Plus } from 'lucide-react'
import { formatClock, parseMinutes } from '@/lib/format'
import { EditableValue } from './EditableValue'

const MIN = 60_000

/**
 * The big single-duration dial (AMRAP, time cap). −/+ walks whole minutes;
 * tapping the number types one in — "9" for nine minutes, "7:30" or "7.5"
 * when the programming isn't round.
 */
export function MinutePicker({
  label,
  valueMs,
  chips,
  onChange,
}: {
  label: string
  valueMs: number
  /** Quick-pick values, in minutes. */
  chips: number[]
  onChange: (ms: number) => void
}) {
  const clamp = (ms: number) => Math.min(90 * MIN, Math.max(5000, ms))
  const wholeMinutes = valueMs % MIN === 0
  const display = wholeMinutes ? `${valueMs / MIN}` : formatClock(valueMs)
  const step = (delta: number) => onChange(clamp(Math.round(valueMs / MIN) * MIN + delta))

  return (
    <div className="flex flex-col items-center gap-5">
      <span className="text-sm font-semibold uppercase tracking-[0.2em] text-chalk-dim">
        {label}
      </span>
      <div className="flex items-center gap-6">
        <button
          type="button"
          aria-label="One minute less"
          onClick={() => step(-MIN)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-raised text-chalk active:bg-edge"
        >
          <Minus size={26} />
        </button>
        <span className="flex items-baseline font-display text-7xl text-chalk">
          <EditableValue
            value={display}
            onCommit={(text) => {
              const ms = parseMinutes(text)
              if (ms !== null) onChange(clamp(ms))
            }}
            ariaLabel={`${label} — type a time`}
            inputMode="decimal"
            className="w-[4ch] text-center font-display text-7xl text-chalk"
          />
          {wholeMinutes && <span className="ml-1 text-3xl text-chalk-dim">min</span>}
        </span>
        <button
          type="button"
          aria-label="One minute more"
          onClick={() => step(MIN)}
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
            onClick={() => onChange(c * MIN)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              c * MIN === valueMs
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
