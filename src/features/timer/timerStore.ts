import { create } from 'zustand'
import { db } from '@/lib/db/db'
import { cancelScheduledCues, unlockAudio } from './audio/audioEngine'
import { compile } from './engine/compile'
import { computeView } from './engine/runtime'
import type {
  CompiledTimer,
  TimerConfig,
  TimerEvent,
  TimerView,
} from './engine/types'

interface TimerState {
  compiled: CompiledTimer | null
  events: TimerEvent[]
  view: TimerView | null
  /** Must be called from a user gesture — unlocks audio. */
  start: (config: TimerConfig) => void
  pause: () => void
  resume: () => void
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

// Refresh at 10 Hz granularity: only publish a new view when something the
// screen shows could have changed, so rAF-driven refreshes don't re-render
// the tree 60 times a second.
let lastViewKey = ''

export const useTimerStore = create<TimerState>((set, get) => ({
  compiled: null,
  events: [],
  view: null,

  start: (config) => {
    unlockAudio()
    const compiled = compile(config)
    const events: TimerEvent[] = [{ type: 'start', at: Date.now() }]
    persist(config, events)
    lastViewKey = ''
    set({ compiled, events, view: computeView(compiled, events, Date.now()) })
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

  finish: () => {
    const { compiled, events, view } = get()
    if (!compiled || !view || view.phase === 'done' || view.phase === 'idle') return
    const next: TimerEvent[] = [...events, { type: 'finish', at: Date.now() }]
    persist(compiled.config, next)
    set({ events: next, view: computeView(compiled, next, Date.now()) })
  },

  dismiss: () => {
    cancelScheduledCues()
    void db.activeSession.delete('current')
    lastViewKey = ''
    set({ compiled: null, events: [], view: null })
  },

  refresh: () => {
    const { compiled, events } = get()
    if (!compiled || events.length === 0) return
    const view = computeView(compiled, events, Date.now())
    const key = `${view.phase}:${view.segment?.index ?? -1}:${Math.floor(view.elapsedActiveMs / 100)}`
    if (key === lastViewKey) return
    lastViewKey = key
    set({ view })
  },

  restoreFromDb: async () => {
    if (get().compiled) return
    const row = await db.activeSession.get('current')
    if (!row) return
    const compiled = compile(row.config)
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
