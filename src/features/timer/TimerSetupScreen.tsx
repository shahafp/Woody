import { useLiveQuery } from 'dexie-react-hooks'
import { Bookmark, X } from 'lucide-react'
import { useState } from 'react'
import { InstallHint } from '@/app/InstallHint'
import { db } from '@/lib/db/db'
import { formatClock } from '@/lib/format'
import { newId } from '@/lib/ids'
import { CompositeBuilder } from './components/CompositeBuilder'
import { ChipRow, CompactStepper } from './components/CompactStepper'
import { MinutePicker } from './components/MinutePicker'
import { compile } from './engine/compile'
import {
  amrap,
  type CompositeBlockSpec,
  defaultBlock,
  describe,
  forTime,
  interval,
  MODE_LABELS,
  ratioInterval,
  ratioLabel,
  stampBlocks,
} from './engine/presets'
import type { CompositeBlock, TimerConfig, TimerMode } from './engine/types'
import { deletePreset, savePreset } from './presetsRepo'
import { useTimerStore } from './timerStore'

const MODES: TimerMode[] = ['forTime', 'amrap', 'emom', 'interval', 'ratioInterval', 'composite']

const MODE_HINTS: Record<TimerMode, string> = {
  forTime: 'Count-up clock with a time cap. Hit Finish to record your time.',
  amrap: 'As many rounds as possible before the clock runs out.',
  emom: 'New round every interval, on the minute.',
  interval: 'Fixed work and rest, repeated for rounds.',
  ratioInterval: 'Work until you tap Round Done — rest matches your work time at the ratio you pick.',
  custom: 'Your own sequence of work and rest steps, repeated for rounds.',
  composite: 'Chain blocks — EMOM, AMRAP, intervals, work, rest — into one workout that runs end to end.',
}

/** Faithfully expand a legacy custom preset into chipper blocks (same timeline). */
function customToBlocks(config: Extract<TimerConfig, { mode: 'custom' }>): CompositeBlock[] {
  const specs: CompositeBlockSpec[] = []
  for (let r = 1; r <= config.rounds; r++) {
    config.steps.forEach((step, i) => {
      const isTrailingRest =
        step.kind === 'rest' && r === config.rounds && i === config.steps.length - 1
      if (isTrailingRest) return
      specs.push(
        step.kind === 'work'
          ? { type: 'work', durationMs: step.durationMs, label: step.label }
          : { type: 'rest', durationMs: step.durationMs },
      )
    })
  }
  return stampBlocks(specs, newId)
}

const SEC = 1000
const clampSec = (s: number) => Math.min(600, Math.max(5, s))
const clampRounds = (r: number) => Math.min(99, Math.max(1, r))

export function TimerSetupScreen() {
  const start = useTimerStore((s) => s.start)
  const presets = useLiveQuery(
    () =>
      db.timerPresets
        .orderBy('name')
        .filter((p) => p.deletedAt === null)
        .toArray(),
    [],
  )

  const [mode, setMode] = useState<TimerMode>('amrap')
  const [amrapMin, setAmrapMin] = useState(12)
  const [capMin, setCapMin] = useState(20)
  const [emomIntervalSec, setEmomIntervalSec] = useState(60)
  const [emomRounds, setEmomRounds] = useState(10)
  const [intWorkSec, setIntWorkSec] = useState(40)
  const [intRestSec, setIntRestSec] = useState(20)
  const [intRounds, setIntRounds] = useState(5)
  const [ratioX, setRatioX] = useState(1)
  const [ratioRounds, setRatioRounds] = useState(6)
  const [compositeBlocks, setCompositeBlocks] = useState<CompositeBlock[]>(() =>
    stampBlocks([defaultBlock('interval')], newId),
  )
  const [savingName, setSavingName] = useState<string | null>(null)

  const config: TimerConfig =
    mode === 'forTime'
      ? forTime(capMin)
      : mode === 'amrap'
        ? amrap(amrapMin)
        : mode === 'emom'
          ? { mode: 'emom', intervalMs: emomIntervalSec * SEC, rounds: emomRounds }
          : mode === 'interval'
            ? interval(intRounds, intWorkSec, intRestSec)
            : mode === 'ratioInterval'
              ? ratioInterval(ratioRounds, ratioX)
              : { mode: 'composite', blocks: compositeBlocks }

  const workoutMs = compile(config, 0).totalMs

  const loadConfig = (c: TimerConfig) => {
    // Legacy custom presets open in the chipper builder (identical timeline).
    if (c.mode === 'custom') {
      setMode('composite')
      setCompositeBlocks(customToBlocks(c))
      return
    }
    setMode(c.mode)
    switch (c.mode) {
      case 'forTime':
        setCapMin(Math.round(c.capMs / 60000))
        break
      case 'amrap':
        setAmrapMin(Math.round(c.durationMs / 60000))
        break
      case 'emom':
        setEmomIntervalSec(Math.round(c.intervalMs / SEC))
        setEmomRounds(c.rounds)
        break
      case 'interval':
        setIntWorkSec(Math.round(c.workMs / SEC))
        setIntRestSec(Math.round(c.restMs / SEC))
        setIntRounds(c.rounds)
        break
      case 'ratioInterval':
        setRatioX(c.ratio)
        setRatioRounds(c.rounds)
        break
      case 'composite':
        setCompositeBlocks(c.blocks)
        break
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <h1 className="font-display text-3xl tracking-wide text-chalk">TIMER</h1>

      {presets && presets.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {presets.map((p) => (
            <span
              key={p.id}
              className="flex shrink-0 items-center gap-1 rounded-full bg-raised pl-3 text-sm font-semibold text-chalk"
            >
              <button type="button" className="py-2" onClick={() => loadConfig(p.config)}>
                {p.name}
              </button>
              <button
                type="button"
                aria-label={`Delete preset ${p.name}`}
                onClick={() => void deletePreset(p.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-chalk-dim active:text-alarm"
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-xl px-2 py-2.5 text-base font-semibold ${
              mode === m
                ? 'bg-chalk text-surface'
                : 'bg-raised text-chalk-dim active:bg-edge'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-chalk-dim">{MODE_HINTS[mode]}</p>

      <div className="flex-1 py-6">
        {mode === 'amrap' && (
          <div className="flex justify-center py-6">
            <MinutePicker
              label="Duration"
              minutes={amrapMin}
              chips={[8, 10, 12, 15, 20, 25]}
              onChange={setAmrapMin}
            />
          </div>
        )}

        {mode === 'forTime' && (
          <div className="flex justify-center py-6">
            <MinutePicker
              label="Time cap"
              minutes={capMin}
              chips={[10, 15, 20, 25, 30, 40]}
              onChange={setCapMin}
            />
          </div>
        )}

        {mode === 'emom' && (
          <div className="flex flex-col gap-5">
            <CompactStepper
              label="Every"
              display={formatClock(emomIntervalSec * SEC)}
              onDecrement={() => setEmomIntervalSec((v) => clampSec(v - 15))}
              onIncrement={() => setEmomIntervalSec((v) => clampSec(v + 15))}
            />
            <ChipRow
              values={[30, 45, 60, 90, 120, 180]}
              selected={emomIntervalSec}
              format={(v) => formatClock(v * SEC)}
              onSelect={setEmomIntervalSec}
            />
            <CompactStepper
              label="Rounds"
              display={`${emomRounds}`}
              onDecrement={() => setEmomRounds((v) => clampRounds(v - 1))}
              onIncrement={() => setEmomRounds((v) => clampRounds(v + 1))}
            />
            <ChipRow
              values={[6, 8, 10, 12, 15, 20]}
              selected={emomRounds}
              format={(v) => `${v}`}
              onSelect={setEmomRounds}
            />
          </div>
        )}

        {mode === 'interval' && (
          <div className="flex flex-col gap-5">
            <CompactStepper
              label="Work"
              display={formatClock(intWorkSec * SEC)}
              onDecrement={() => setIntWorkSec((v) => clampSec(v - 5))}
              onIncrement={() => setIntWorkSec((v) => clampSec(v + 5))}
            />
            <ChipRow
              values={[20, 30, 40, 45, 60, 90]}
              selected={intWorkSec}
              format={(v) => formatClock(v * SEC)}
              onSelect={setIntWorkSec}
            />
            <CompactStepper
              label="Rest"
              display={formatClock(intRestSec * SEC)}
              onDecrement={() => setIntRestSec((v) => clampSec(v - 5))}
              onIncrement={() => setIntRestSec((v) => clampSec(v + 5))}
            />
            <ChipRow
              values={[10, 15, 20, 30, 45, 60]}
              selected={intRestSec}
              format={(v) => formatClock(v * SEC)}
              onSelect={setIntRestSec}
            />
            <CompactStepper
              label="Rounds"
              display={`${intRounds}`}
              onDecrement={() => setIntRounds((v) => clampRounds(v - 1))}
              onIncrement={() => setIntRounds((v) => clampRounds(v + 1))}
            />
          </div>
        )}

        {mode === 'ratioInterval' && (
          <div className="flex flex-col gap-5">
            <span className="text-sm font-semibold uppercase tracking-[0.15em] text-chalk-dim">
              Work : rest
            </span>
            <ChipRow
              values={[0.5, 1, 2]}
              selected={ratioX}
              format={ratioLabel}
              onSelect={setRatioX}
            />
            <CompactStepper
              label="Rounds"
              display={`${ratioRounds}`}
              onDecrement={() => setRatioRounds((v) => clampRounds(v - 1))}
              onIncrement={() => setRatioRounds((v) => clampRounds(v + 1))}
            />
            <ChipRow
              values={[3, 4, 5, 6, 8, 10]}
              selected={ratioRounds}
              format={(v) => `${v}`}
              onSelect={setRatioRounds}
            />
          </div>
        )}

        {mode === 'composite' && (
          <CompositeBuilder blocks={compositeBlocks} onChange={setCompositeBlocks} />
        )}
      </div>

      <div className="mb-3 flex items-center justify-between gap-3 text-sm text-chalk-dim">
        <span className="min-w-0 truncate">
          {describe(config)}
          {mode !== 'ratioInterval' && ` · total ${formatClock(workoutMs)}`}
        </span>
        {savingName === null ? (
          <button
            type="button"
            onClick={() => setSavingName(describe(config))}
            className="flex shrink-0 items-center gap-1.5 font-semibold text-chalk"
          >
            <Bookmark size={16} /> Save
          </button>
        ) : null}
      </div>

      {savingName !== null && (
        <div className="mb-3 flex gap-2">
          <input
            value={savingName}
            onChange={(e) => setSavingName(e.target.value)}
            placeholder="Preset name"
            className="min-w-0 flex-1 rounded-xl bg-raised px-4 py-3 text-base text-chalk outline-none placeholder:text-chalk-dim"
          />
          <button
            type="button"
            onClick={() => {
              if (savingName.trim()) {
                void savePreset(savingName, config)
                setSavingName(null)
              }
            }}
            className="rounded-xl bg-chalk px-4 font-semibold text-surface"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setSavingName(null)}
            className="rounded-xl bg-raised px-4 font-semibold text-chalk-dim"
          >
            Cancel
          </button>
        </div>
      )}

      <button
        type="button"
        disabled={mode === 'composite' && compositeBlocks.length === 0}
        onClick={() => start(config)}
        className="h-16 w-full rounded-2xl bg-work font-display text-2xl tracking-wider text-surface active:opacity-90 disabled:opacity-40"
      >
        START
      </button>
      <p className="mt-3 text-center text-xs text-chalk-dim">
        10 second countdown before the clock starts.
      </p>
      <InstallHint />
    </div>
  )
}
