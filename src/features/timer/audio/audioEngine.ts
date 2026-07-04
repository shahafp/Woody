import type { CueSound } from '../engine/types'

/**
 * Web Audio cue engine. The context is created and resumed inside a user
 * gesture (the Start tap) — the only reliable way to unlock audio on iOS and
 * Android. Cues are synthesized oscillators: nothing to load, nothing to
 * decode, and scheduling at ctx.currentTime offsets is sample-accurate even
 * when the JS tick jitters.
 */

let ctx: AudioContext | null = null
let scheduled: OscillatorNode[] = []

export function unlockAudio(): void {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
}

/** Current context time, or null when audio is unavailable/locked. */
export function audioNow(): number | null {
  return ctx && ctx.state === 'running' ? ctx.currentTime : null
}

interface Tone {
  freq: number
  durationS: number
  type: OscillatorType
  gain: number
}

const TONES: Record<CueSound, Tone> = {
  tick: { freq: 880, durationS: 0.1, type: 'square', gain: 0.3 },
  go: { freq: 1320, durationS: 0.45, type: 'square', gain: 0.5 },
  transition: { freq: 620, durationS: 0.35, type: 'square', gain: 0.45 },
  finish: { freq: 220, durationS: 1.1, type: 'sawtooth', gain: 0.6 },
}

export function scheduleCue(sound: CueSound, whenCtxTime: number): void {
  if (!ctx || ctx.state !== 'running') return
  const spec = TONES[sound]
  const t = Math.max(whenCtxTime, ctx.currentTime)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = spec.type
  osc.frequency.value = spec.freq
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(spec.gain, t + 0.012)
  gain.gain.setValueAtTime(spec.gain, t + Math.max(0.012, spec.durationS - 0.06))
  gain.gain.exponentialRampToValueAtTime(0.0001, t + spec.durationS)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t)
  osc.stop(t + spec.durationS + 0.02)
  scheduled.push(osc)
  osc.onended = () => {
    scheduled = scheduled.filter((s) => s !== osc)
  }
}

/** Stop everything pending — called on pause and on discard. */
export function cancelScheduledCues(): void {
  for (const osc of scheduled) {
    try {
      osc.stop()
    } catch {
      // already stopped
    }
  }
  scheduled = []
}
