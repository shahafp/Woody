import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { formatClock, formatCountdown } from '@/lib/format'
import { t } from '@/lib/i18n/t'
import { setLogDraft } from '@/features/log/logDraft'
import { SegmentBar } from './components/SegmentBar'
import { TimeDigits } from './components/TimeDigits'
import { describe } from './engine/presets'
import type { CueSound } from './engine/types'
import { useTimerRunner } from './hooks/useTimerRunner'
import { useWakeLock, wakeLockSupported } from './hooks/useWakeLock'
import { useTimerStore } from './timerStore'

const FLASH_COLORS: Record<CueSound, string> = {
  tick: 'bg-chalk',
  go: 'bg-work',
  transition: 'bg-rest',
  finish: 'bg-alarm',
}

export function TimerRunScreen() {
  const compiled = useTimerStore((s) => s.compiled)
  const view = useTimerStore((s) => s.view)
  const pause = useTimerStore((s) => s.pause)
  const resume = useTimerStore((s) => s.resume)
  const finish = useTimerStore((s) => s.finish)
  const lap = useTimerStore((s) => s.lap)
  const dismiss = useTimerStore((s) => s.dismiss)
  const flash = useTimerRunner()
  const navigate = useNavigate()

  const running = view?.phase === 'prep' || view?.phase === 'running'
  useWakeLock(running)

  const [endArmed, setEndArmed] = useState(false)
  useEffect(() => {
    if (!endArmed) return
    const t = setTimeout(() => setEndArmed(false), 3000)
    return () => clearTimeout(t)
  }, [endArmed])

  if (!compiled || !view) return null

  const { phase, segment } = view
  const openWork = phase === 'running' && segment?.open === true
  const isForTime = compiled.config.mode === 'forTime'
  const finalStretch =
    phase === 'running' && view.totalRemainingMs <= 10_000

  const digitColor =
    phase === 'paused'
      ? 'text-chalk-dim'
      : finalStretch || phase === 'done'
        ? 'text-alarm'
        : phase === 'prep'
          ? 'text-chalk'
          : segment?.kind === 'rest'
            ? 'text-rest'
            : 'text-work'

  const digits =
    phase === 'done'
      ? formatClock(view.finishedWorkMs ?? 0)
      : phase === 'prep'
        ? formatCountdown(view.segmentRemainingMs)
        : isForTime
          ? formatClock(view.workElapsedMs)
          : segment?.open
            ? formatClock(view.segmentElapsedMs)
            : formatCountdown(view.segmentRemainingMs)

  const eyebrow =
    phase === 'done'
      ? isForTime
        ? 'TIME'
        : 'DONE'
      : phase === 'paused'
        ? 'PAUSED'
        : (segment?.label ?? '').toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex select-none flex-col bg-surface pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+16px)]">
      {/* cue flash — also the visual fallback when iOS silent switch mutes audio */}
      {flash && (
        <div
          key={flash.key}
          className={`pointer-events-none absolute inset-0 ${FLASH_COLORS[flash.sound]}`}
          style={{ animation: 'cue-flash 400ms ease-out forwards' }}
        />
      )}

      <header className="flex items-center justify-between px-5 pt-3">
        <span className="text-sm font-semibold tracking-[0.2em] text-chalk-dim">
          {describe(compiled.config)}
        </span>
        <button
          type="button"
          onClick={() => (endArmed ? dismiss() : setEndArmed(true))}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            endArmed ? 'bg-alarm text-surface' : 'bg-raised text-chalk-dim'
          }`}
        >
          {endArmed ? 'Tap to end' : 'End'}
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
        <span className="text-lg font-semibold tracking-[0.25em] text-chalk-dim">
          {eyebrow}
        </span>
        <TimeDigits
          text={digits}
          className={`${digitColor} ${
            finalStretch ? 'animate-[alarm-pulse_1s_ease-in-out_infinite]' : ''
          }`}
        />
        {view.totalRounds > 1 && phase !== 'done' && (
          <span className="font-display text-2xl tracking-wide text-chalk">
            ROUND {view.round}/{view.totalRounds}
          </span>
        )}
        {phase !== 'done' && (
          <span className="text-base text-chalk-dim">
            {isForTime
              ? `cap ${formatCountdown(view.totalRemainingMs)}`
              : `elapsed ${formatClock(view.workElapsedMs)}`}
          </span>
        )}
        {(() => {
          if (phase !== 'running' && phase !== 'prep') return null
          const next = segment ? compiled.segments[segment.index + 1] : null
          if (!next || (segment && next.kind === segment.kind)) return null
          return (
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-chalk-dim">
              next: {next.kind === 'rest' ? 'rest' : next.label}
              {next.open ? '' : ` ${formatClock(next.durationMs)}`}
            </span>
          )
        })()}
      </main>

      <footer className="flex flex-col gap-3 px-5">
        <SegmentBar compiled={compiled} elapsedMs={view.elapsedActiveMs} />
        {!wakeLockSupported && running && (
          <p className="text-center text-sm text-chalk-dim">
            Keep your screen on — this browser can’t hold it awake.
          </p>
        )}
        {phase === 'done' ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={dismiss}
              className="h-16 flex-1 rounded-2xl bg-raised font-display text-2xl tracking-wider text-chalk"
            >
              CLOSE
            </button>
            <button
              type="button"
              onClick={() => {
                setLogDraft({
                  title: describe(compiled.config),
                  timerConfig: compiled.config,
                  resultType: isForTime
                    ? 'time'
                    : compiled.config.mode === 'amrap'
                      ? 'rounds_reps'
                      : 'none',
                  timeMs: isForTime ? (view.finishedWorkMs ?? undefined) : undefined,
                })
                dismiss()
                void navigate('/log/new')
              }}
              className="h-16 flex-1 rounded-2xl bg-work font-display text-2xl tracking-wider text-surface"
            >
              {t('log.logIt')}
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={phase === 'paused' ? resume : pause}
              className={`h-16 flex-1 rounded-2xl font-display text-2xl tracking-wider ${
                phase === 'paused'
                  ? 'bg-work text-surface'
                  : 'bg-raised text-chalk'
              }`}
            >
              {phase === 'paused' ? 'RESUME' : 'PAUSE'}
            </button>
            {isForTime && phase !== 'paused' && phase !== 'prep' && (
              <button
                type="button"
                onClick={finish}
                className="h-16 flex-1 rounded-2xl bg-work font-display text-2xl tracking-wider text-surface"
              >
                FINISH
              </button>
            )}
            {openWork && (
              <button
                type="button"
                onClick={lap}
                className="h-16 flex-1 rounded-2xl bg-work font-display text-2xl tracking-wider text-surface"
              >
                {view.round >= view.totalRounds ? 'FINISH' : 'ROUND DONE'}
              </button>
            )}
          </div>
        )}
      </footer>
    </div>
  )
}
