import { create } from 'zustand'
import { db } from '@/lib/db/db'
import { addAutoLog } from '@/features/log/logRepo'
import { useSettingsStore } from '@/features/settings/settingsStore'
import {
  audioNow,
  cancelScheduledCues,
  scheduleCue,
  unlockAudio,
} from './audio/audioEngine'
import { compile, DEFAULT_PREP_MS } from './engine/compile'
import { describe } from './engine/presets'
import { computeView, lapOffsets } from './engine/runtime'
import type {
  CompiledTimer,
  CueSound,
  TimerConfig,
  TimerEvent,
  TimerView,
} from './engine/types'

interface TimerState {
  compiled: CompiledTimer | null
  events: TimerEvent[]
  view: TimerView | null
  /** Id of the log entry auto-saved for the just-finished session, if any. */
  lastAutoLogId: string | null
  /** Must be called from a user gesture — unlocks audio. */
  start: (config: TimerConfig) => void
  pause: () => void
  resume: () => void
  /** DONE tap: close the current open work segment (ratioInterval). */
  lap: () => void
  /** Manual finish (For Time) — captures the result. */
  finish: () => void
  /** Close the run screen and drop the session. */
  dismiss: () => void
  /** Recompute the view from wall clock; cheap and idempotent. */
  refresh: () => void
  /** Restore an unfinished session found in Dexie on boot. */
  restoreFromDb: () => Promise<void>
}

function persist(config: TimerConfig, events: TimerEvent[]): void {
  void db.activeSession.put({
    id: 'current',
    config,
    events,
    startedAt: events[0]?.at ?? Date.now(),
  })
}

/**
 * Immediate cue for the lap tap itself. Compiled cues at-or-before the
 * current elapsed time are never replayed by the runner, so the sound for
 * a boundary created *by* the tap has to be played imperatively.
 */
function tapFeedback(sound: CueSound, vibrate: number[]): void {
  if (useSettingsStore.getState().soundEnabled) {
    const now = audioNow()
    if (now !== null) scheduleCue(sound, now)
  }
  if ('vibrate' in navigator && useSettingsStore.getState().vibrateEnabled) {
    navigator.vibrate(vibrate)
  }
}

// Refresh at 10 Hz granularity: only publish a new view when something the
// screen shows could have changed, so rAF-driven refreshes don't re-render
// the tree 60 times a second.
let lastViewKey = ''

// The session (keyed by its start timestamp) already auto-saved to the log.
// A session reaches 'done' via finish/lap/clock, so recording is guarded here
// once rather than at each of those call sites.
let recordedStartAt: number | null = null

/**
 * Auto-save a finished workout to the log exactly once so a stray CLOSE can't
 * lose it. For Time captures its final time; other modes have no measured
 * result and are logged as a timestamped placeholder to enrich later.
 */
function recordDone(
  compiled: CompiledTimer,
  events: TimerEvent[],
  view: TimerView,
  set: (partial: Partial<TimerState>) => void,
): void {
  if (view.phase !== 'done') return
  const startAt = events[0]?.at
  if (startAt === undefined || startAt === recordedStartAt) return
  recordedStartAt = startAt
  const config = compiled.config
  const isForTime = config.mode === 'forTime'
  void addAutoLog({
    performedAt: new Date().toISOString().slice(0, 10),
    title: describe(config),
    description: '',
    timerConfig: config,
    resultType: isForTime ? 'time' : 'none',
    result: isForTime ? { timeMs: view.finishedWorkMs ?? view.workElapsedMs } : {},
    rx: true,
    notes: null,
  }).then((row) => set({ lastAutoLogId: row.id }))
}

export const useTimerStore = create<TimerState>((set, get) => ({
  compiled: null,
  events: [],
  view: null,
  lastAutoLogId: null,

  start: (config) => {
    unlockAudio()
    const compiled = compile(config)
    const events: TimerEvent[] = [{ type: 'start', at: Date.now() }]
    persist(config, events)
    lastViewKey = ''
    recordedStartAt = null
    set({ compiled, events, view: computeView(compiled, events, Date.now()), lastAutoLogId: null })
  },

  pause: () => {
    const { compiled, events, view } = get()
    if (!compiled || !view) return
    if (view.phase !== 'running' && view.phase !== 'prep') return
    cancelScheduledCues()
    const next: TimerEvent[] = [...events, { type: 'pause', at: Date.now() }]
    persist(compiled.config, next)
    set({ events: next, view: computeView(compiled, next, Date.now()) })
  },

  resume: () => {
    const { compiled, events, view } = get()
    if (!compiled || view?.phase !== 'paused') return
    unlockAudio()
    const next: TimerEvent[] = [...events, { type: 'resume', at: Date.now() }]
    persist(compiled.config, next)
    set({ events: next, view: computeView(compiled, next, Date.now()) })
  },

  lap: () => {
    const { compiled, events, view } = get()
    if (!compiled || !view) return
    if (view.phase !== 'running' || view.segment?.open !== true) return
    if (view.segmentElapsedMs < 1000) return // double-tap guard
    const config = compiled.config
    const next: TimerEvent[] = [...events, { type: 'lap', at: Date.now() }]
    const laps = lapOffsets(next)
    const recompiled = compile(config, DEFAULT_PREP_MS, laps)
    persist(config, next)
    const closedFinal =
      config.mode === 'ratioInterval' && laps.length >= config.rounds
    tapFeedback(
      closedFinal ? 'finish' : 'transition',
      closedFinal ? [600, 150, 600] : [100, 80, 100],
    )
    const nextView = computeView(recompiled, next, Date.now())
    set({ compiled: recompiled, events: next, view: nextView })
    recordDone(recompiled, next, nextView, set)
  },

  finish: () => {
    const { compiled, events, view } = get()
    if (!compiled || !view || view.phase === 'done' || view.phase === 'idle') return
    const next: TimerEvent[] = [...events, { type: 'finish', at: Date.now() }]
    persist(compiled.config, next)
    const nextView = computeView(compiled, next, Date.now())
    set({ events: next, view: nextView })
    recordDone(compiled, next, nextView, set)
  },

  dismiss: () => {
    cancelScheduledCues()
    void db.activeSession.delete('current')
    lastViewKey = ''
    recordedStartAt = null
    set({ compiled: null, events: [], view: null, lastAutoLogId: null })
  },

  refresh: () => {
    const { compiled, events } = get()
    if (!compiled || events.length === 0) return
    const view = computeView(compiled, events, Date.now())
    const key = `${view.phase}:${view.segment?.index ?? -1}:${Math.floor(view.elapsedActiveMs / 100)}`
    if (key === lastViewKey) return
    lastViewKey = key
    set({ view })
    recordDone(compiled, events, view, set)
  },

  restoreFromDb: async () => {
    if (get().compiled) return
    const row = await db.activeSession.get('current')
    if (!row) return
    const compiled = compile(row.config, DEFAULT_PREP_MS, lapOffsets(row.events))
    const view = computeView(compiled, row.events, Date.now())
    if (view.phase === 'done' || view.phase === 'idle') {
      // Stale or meaningless — a workout that ended while the app was closed.
      void db.activeSession.delete('current')
      return
    }
    lastViewKey = ''
    set({ compiled, events: row.events, view })
  },
}))
