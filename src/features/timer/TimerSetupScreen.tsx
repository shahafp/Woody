import { useState } from 'react'
import { MinutePicker } from './components/MinutePicker'
import { amrap, forTime, MODE_LABELS } from './engine/presets'
import { useTimerStore } from './timerStore'

const M1_MODES = ['forTime', 'amrap'] as const
type SetupMode = (typeof M1_MODES)[number]

export function TimerSetupScreen() {
  const start = useTimerStore((s) => s.start)
  const [mode, setMode] = useState<SetupMode>('amrap')
  const [amrapMin, setAmrapMin] = useState(12)
  const [capMin, setCapMin] = useState(20)

  return (
    <div className="flex h-full flex-col">
      <h1 className="font-display text-3xl tracking-wide text-chalk">TIMER</h1>

      <div className="mt-5 flex gap-2">
        {M1_MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-xl px-4 py-3 text-base font-semibold ${
              mode === m
                ? 'bg-chalk text-surface'
                : 'bg-raised text-chalk-dim active:bg-edge'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-chalk-dim">
        {mode === 'amrap'
          ? 'As many rounds as possible before the clock runs out.'
          : 'Count-up clock with a time cap. Hit Finish to record your time.'}
      </p>

      <div className="flex flex-1 items-center justify-center py-8">
        {mode === 'amrap' ? (
          <MinutePicker
            label="Duration"
            minutes={amrapMin}
            chips={[8, 10, 12, 15, 20, 25]}
            onChange={setAmrapMin}
          />
        ) : (
          <MinutePicker
            label="Time cap"
            minutes={capMin}
            chips={[10, 15, 20, 25, 30, 40]}
            onChange={setCapMin}
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => start(mode === 'amrap' ? amrap(amrapMin) : forTime(capMin))}
        className="h-16 w-full rounded-2xl bg-work font-display text-2xl tracking-wider text-surface active:opacity-90"
      >
        START
      </button>
      <p className="mt-3 text-center text-xs text-chalk-dim">
        10 second countdown before the clock starts.
      </p>
    </div>
  )
}
