import { describe, expect, it } from 'vitest'
import { compile } from './compile'
import { activeElapsed, computeView, cuesInWindow, lapOffsets } from './runtime'
import type { TimerEvent } from './types'

const MIN = 60_000
const T0 = 1_750_000_000_000 // arbitrary epoch base

const amrap10 = compile({ mode: 'amrap', durationMs: 10 * MIN })
const forTime20 = compile({ mode: 'forTime', capMs: 20 * MIN })

function ev(...pairs: Array<[TimerEvent['type'], number]>): TimerEvent[] {
  return pairs.map(([type, offset]) => ({ type, at: T0 + offset }))
}

describe('activeElapsed', () => {
  it('excludes paused spans', () => {
    const events = ev(['start', 0], ['pause', 15_000], ['resume', 100_000])
    expect(activeElapsed(events, T0 + 105_000)).toBe(20_000)
  })

  it('freezes while paused no matter how long', () => {
    const events = ev(['start', 0], ['pause', 15_000])
    expect(activeElapsed(events, T0 + 999_000)).toBe(15_000)
  })

  it('stops at finish', () => {
    const events = ev(['start', 0], ['finish', 372_000])
    expect(activeElapsed(events, T0 + 500_000)).toBe(372_000)
  })

  it('ignores lap events — the clock keeps running through a tap', () => {
    const events = ev(['start', 0], ['lap', 40_000])
    expect(activeElapsed(events, T0 + 60_000)).toBe(60_000)
  })
})

describe('lapOffsets', () => {
  it('maps laps to active-time offsets', () => {
    const events = ev(['start', 0], ['lap', 107_000], ['lap', 250_000])
    expect(lapOffsets(events)).toEqual([107_000, 250_000])
  })

  it('is pause-aware: a lap after a pause excludes the paused span', () => {
    const events = ev(['start', 0], ['pause', 30_000], ['resume', 90_000], ['lap', 100_000])
    expect(lapOffsets(events)).toEqual([40_000])
  })

  it('a lap while paused lands at the pause point', () => {
    const events = ev(['start', 0], ['pause', 30_000], ['lap', 50_000])
    expect(lapOffsets(events)).toEqual([30_000])
  })

  it('no laps → empty', () => {
    expect(lapOffsets(ev(['start', 0]))).toEqual([])
  })
})

describe('computeView', () => {
  it('idle before any event', () => {
    expect(computeView(amrap10, [], T0).phase).toBe('idle')
  })

  it('prep phase during the first 10s', () => {
    const v = computeView(amrap10, ev(['start', 0]), T0 + 5000)
    expect(v.phase).toBe('prep')
    expect(v.segmentRemainingMs).toBe(5000)
    expect(v.workElapsedMs).toBe(0)
  })

  it('running after prep; workElapsed excludes prep', () => {
    const v = computeView(amrap10, ev(['start', 0]), T0 + 12_000)
    expect(v.phase).toBe('running')
    expect(v.workElapsedMs).toBe(2000)
    expect(v.totalRemainingMs).toBe(10 * MIN - 2000)
  })

  it('a 45s background gap lands in the right position', () => {
    // no ticks arrived for 45s — view must still be exact
    const v = computeView(amrap10, ev(['start', 0]), T0 + 45_000)
    expect(v.phase).toBe('running')
    expect(v.workElapsedMs).toBe(35_000)
  })

  it('paused view is frozen', () => {
    const events = ev(['start', 0], ['pause', 30_000])
    const v = computeView(amrap10, events, T0 + 500_000)
    expect(v.phase).toBe('paused')
    expect(v.workElapsedMs).toBe(20_000)
  })

  it('done when elapsed reaches total; result clamps to duration', () => {
    const v = computeView(amrap10, ev(['start', 0]), T0 + 20 * MIN)
    expect(v.phase).toBe('done')
    expect(v.finishedWorkMs).toBe(10 * MIN)
    expect(v.totalRemainingMs).toBe(0)
  })

  it('forTime manual finish captures the result', () => {
    const events = ev(['start', 0], ['finish', 372_000])
    const v = computeView(forTime20, events, T0 + 500_000)
    expect(v.phase).toBe('done')
    expect(v.finishedWorkMs).toBe(362_000) // minus 10s prep
  })

  it('forTime hits the cap', () => {
    const v = computeView(forTime20, ev(['start', 0]), T0 + 30 * MIN)
    expect(v.phase).toBe('done')
    expect(v.finishedWorkMs).toBe(20 * MIN)
  })

  it('pause during prep works', () => {
    const events = ev(['start', 0], ['pause', 4000], ['resume', 60_000])
    const v = computeView(amrap10, events, T0 + 63_000)
    expect(v.phase).toBe('prep')
    expect(v.segmentRemainingMs).toBe(3000)
  })

  it('EMOM round tracking', () => {
    const emom10 = compile({ mode: 'emom', intervalMs: MIN, rounds: 10 })
    const v = computeView(emom10, ev(['start', 0]), T0 + 10_000 + 3 * MIN + 5000)
    expect(v.round).toBe(4)
    expect(v.segment?.label).toBe('Min 4/10')
    expect(v.segmentRemainingMs).toBe(55_000)
  })
})

describe('cuesInWindow', () => {
  it('is exclusive at from, inclusive at to', () => {
    // amrap prep ticks at 7000/8000/9000, go at 10000
    expect(cuesInWindow(amrap10, 7000, 9000).map((c) => c.atMs)).toEqual([8000, 9000])
    expect(cuesInWindow(amrap10, 9000, 10_000).map((c) => c.sound)).toEqual(['go'])
  })

  it('empty window yields nothing', () => {
    expect(cuesInWindow(amrap10, 20_000, 20_000)).toHaveLength(0)
  })
})
