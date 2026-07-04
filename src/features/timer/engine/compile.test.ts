import { describe, expect, it } from 'vitest'
import { compile } from './compile'

const MIN = 60_000
const SEC = 1_000

describe('compile', () => {
  it('forTime: prep + one capped work segment, counts up', () => {
    const t = compile({ mode: 'forTime', capMs: 20 * MIN })
    expect(t.segments).toHaveLength(2)
    expect(t.segments[0]).toMatchObject({ kind: 'prep', startMs: 0, durationMs: 10_000 })
    expect(t.segments[1]).toMatchObject({ kind: 'work', startMs: 10_000, durationMs: 20 * MIN })
    expect(t.display).toBe('up')
    expect(t.totalMs).toBe(10_000 + 20 * MIN)
  })

  it('amrap: prep + one work segment, counts down', () => {
    const t = compile({ mode: 'amrap', durationMs: 10 * MIN })
    expect(t.segments).toHaveLength(2)
    expect(t.display).toBe('down')
    expect(t.totalMs).toBe(10_000 + 10 * MIN)
  })

  it('emom 10×1:00: 11 segments with minute boundaries', () => {
    const t = compile({ mode: 'emom', intervalMs: MIN, rounds: 10 })
    expect(t.segments).toHaveLength(11)
    expect(t.segments[1]).toMatchObject({ label: 'Min 1/10', startMs: 10_000, round: 1 })
    expect(t.segments[10]).toMatchObject({ label: 'Min 10/10', startMs: 10_000 + 9 * MIN, round: 10 })
    expect(t.totalMs).toBe(10_000 + 10 * MIN)
  })

  it('interval 5×40/20: no trailing rest', () => {
    const t = compile({ mode: 'interval', workMs: 40 * SEC, restMs: 20 * SEC, rounds: 5 })
    // prep + (work+rest)×4 + final work
    expect(t.segments).toHaveLength(10)
    expect(t.segments[t.segments.length - 1].kind).toBe('work')
    expect(t.totalMs).toBe(10_000 + 5 * 40 * SEC + 4 * 20 * SEC)
  })

  it('custom: expands rounds and skips trailing rest', () => {
    const t = compile({
      mode: 'custom',
      rounds: 3,
      steps: [
        { kind: 'work', durationMs: 30 * SEC },
        { kind: 'rest', durationMs: 15 * SEC },
      ],
    })
    // prep + (w,r) + (w,r) + w — trailing rest dropped
    expect(t.segments).toHaveLength(6)
    expect(t.segments.map((s) => s.kind)).toEqual(['prep', 'work', 'rest', 'work', 'rest', 'work'])
  })

  it('cues: 3-2-1 ticks before every boundary, go on work, finish at end', () => {
    const t = compile({ mode: 'emom', intervalMs: MIN, rounds: 2 })
    // prep ticks at 7/8/9s, go at 10s
    expect(t.cues.filter((c) => c.sound === 'tick').map((c) => c.atMs).slice(0, 3)).toEqual([7000, 8000, 9000])
    expect(t.cues.filter((c) => c.sound === 'go').map((c) => c.atMs)).toEqual([10_000, 70_000])
    // minute-boundary ticks at 57/58/59s of each interval
    expect(t.cues.filter((c) => c.sound === 'tick').map((c) => c.atMs)).toEqual([
      7000, 8000, 9000, 67_000, 68_000, 69_000, 127_000, 128_000, 129_000,
    ])
    expect(t.cues.filter((c) => c.sound === 'finish').map((c) => c.atMs)).toEqual([130_000])
    // sorted
    const times = t.cues.map((c) => c.atMs)
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it('cues: rest segments get a transition cue, short segments get no ticks', () => {
    const t = compile({
      mode: 'custom',
      rounds: 1,
      steps: [
        { kind: 'work', durationMs: 3 * SEC }, // < 4s: no ticks inside
        { kind: 'rest', durationMs: 10 * SEC },
        { kind: 'work', durationMs: 10 * SEC },
      ],
    })
    const transitions = t.cues.filter((c) => c.sound === 'transition')
    expect(transitions.map((c) => c.atMs)).toEqual([13_000])
    // no tick can come from inside the 3s work segment (its end is 13s; ticks at 10/11/12s would exist only if durationMs >= 4000)
    expect(t.cues.filter((c) => c.sound === 'tick' && c.atMs > 9000 && c.atMs < 13_000)).toHaveLength(0)
  })

  it('no prep when prepMs = 0; first work still gets a go cue at 0', () => {
    const t = compile({ mode: 'amrap', durationMs: MIN }, 0)
    expect(t.segments[0].kind).toBe('work')
    expect(t.cues.find((c) => c.sound === 'go')?.atMs).toBe(0)
  })
})
