import { useEffect, useRef, useState } from 'react'
import { useSettingsStore } from '@/features/settings/settingsStore'
import { audioNow, scheduleCue } from '../audio/audioEngine'
import { activeElapsed, cuesInWindow, isPaused } from '../engine/runtime'
import type { CueSound } from '../engine/types'
import { useTimerStore } from '../timerStore'

export interface CueFlash {
  sound: CueSound
  /** Changes on every flash so the CSS animation restarts. */
  key: number
}

const AUDIO_LOOKAHEAD_MS = 1200
const HEARTBEAT_MS = 250
/** Cues older than this on a late tick are swallowed, not replayed. */
const MAX_CUE_LAG_MS = 2000

/**
 * Drives a running session: rAF display refresh + visual/vibration cues,
 * a heartbeat that schedules audio ahead at exact AudioContext offsets,
 * and an immediate recompute when the tab returns to visibility.
 */
export function useTimerRunner(): CueFlash | null {
  const compiled = useTimerStore((s) => s.compiled)
  const events = useTimerStore((s) => s.events)
  const refresh = useTimerStore((s) => s.refresh)
  const [flash, setFlash] = useState<CueFlash | null>(null)

  const audioUpToRef = useRef(0)
  const visualUpToRef = useRef(0)

  useEffect(() => {
    if (!compiled || events.length === 0) return
    if (useTimerStore.getState().view?.phase === 'done') return

    const elapsedNow = () => activeElapsed(events, Date.now())
    let raf = 0
    let heartbeat = 0
    let stopped = false

    // Never replay cues from before this effect took over (mount, resume,
    // or return from a long background gap).
    audioUpToRef.current = elapsedNow()
    visualUpToRef.current = elapsedNow()

    const stopLoops = () => {
      stopped = true
      cancelAnimationFrame(raf)
      clearInterval(heartbeat)
    }

    const tick = () => {
      refresh()
      const e = elapsedNow()
      const due = cuesInWindow(compiled, visualUpToRef.current, e).filter(
        (c) => e - c.atMs <= MAX_CUE_LAG_MS,
      )
      visualUpToRef.current = e
      const last = due[due.length - 1]
      if (last) {
        setFlash({ sound: last.sound, key: Date.now() })
        if (
          last.vibrate &&
          'vibrate' in navigator &&
          useSettingsStore.getState().vibrateEnabled
        ) {
          navigator.vibrate(last.vibrate)
        }
      }
      if (useTimerStore.getState().view?.phase === 'done') stopLoops()
    }

    if (isPaused(events)) {
      tick() // paint the frozen view once
      return
    }

    const loop = () => {
      tick()
      if (!stopped) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    heartbeat = window.setInterval(() => {
      if (!useSettingsStore.getState().soundEnabled) return
      const ctxNow = audioNow()
      if (ctxNow === null) return
      const e = elapsedNow()
      const from = Math.max(audioUpToRef.current, e)
      const to = e + AUDIO_LOOKAHEAD_MS
      for (const cue of cuesInWindow(compiled, from, to)) {
        scheduleCue(cue.sound, ctxNow + (cue.atMs - e) / 1000)
      }
      audioUpToRef.current = to
    }, HEARTBEAT_MS)

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !stopped) tick()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stopLoops()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [compiled, events, refresh])

  return flash
}
