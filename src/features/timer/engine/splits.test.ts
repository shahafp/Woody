import { describe, expect, it } from 'vitest'
import { compile } from './compile'
import { buildSplits, splitDeltaMs, splitStats } from './splits'

const SEC = 1000
const MIN = 60_000

describe('buildSplits on a 1:1 session', () => {
  const cfg = { mode: 'ratioInterval', ratio: 1, rounds: 4 } as const

  it('records each closed round with the rest that followed it', () => {
    // laps at 70s and 200s (10s prep): work 60s / rest 60s, work 70s / rest 70s
    const t = compile(cfg, 10_000, [70_000, 200_000])
    const splits = buildSplits(t, 340_000)
    expect(splits.slice(0, 2)).toEqual([
      { index: 1, workMs: 60_000, restMs: 60_000 },
      { index: 2, workMs: 70_000, restMs: 70_000 },
    ])
  })

  it('marks the round in progress as partial', () => {
    const t = compile(cfg, 10_000, [70_000])
    const splits = buildSplits(t, 155_000) // 25s into round 2's open work
    expect(splits).toHaveLength(2)
    expect(splits[1]).toEqual({ index: 2, workMs: 25_000, partial: true })
  })

  it('does not invent a round the athlete never started', () => {
    const t = compile(cfg, 10_000, [70_000])
    expect(buildSplits(t, 90_000)).toHaveLength(1) // still resting after round 1
  })

  it('clips a rest that was cut short', () => {
    const t = compile(cfg, 10_000, [70_000])
    expect(buildSplits(t, 100_000)[0].restMs).toBe(30_000)
  })

  it('drops the compiler’s "Work n/m" label — the round number already says it', () => {
    const t = compile(cfg, 10_000, [70_000])
    expect(buildSplits(t, 70_000)[0].label).toBeUndefined()
  })
})

describe('buildSplits on fixed timelines', () => {
  it('keeps one entry per interval round with its rest', () => {
    const t = compile({ mode: 'interval', workMs: 40 * SEC, restMs: 20 * SEC, rounds: 3 }, 0)
    const splits = buildSplits(t, t.totalMs)
    expect(splits).toEqual([
      { index: 1, workMs: 40_000, restMs: 20_000 },
      { index: 2, workMs: 40_000, restMs: 20_000 },
      { index: 3, workMs: 40_000 },
    ])
  })

  it('carries block names and the set each round belonged to', () => {
    const t = compile(
      {
        mode: 'composite',
        blocks: [
          {
            id: 'g',
            type: 'group',
            label: 'A',
            sets: 2,
            restBetweenSetsMs: 30 * SEC,
            children: [{ id: 'c', type: 'work', label: 'Thrusters', durationMs: 45 * SEC }],
          },
        ],
      },
      0,
    )
    const splits = buildSplits(t, t.totalMs)
    expect(splits).toEqual([
      {
        index: 1,
        label: 'Thrusters',
        workMs: 45_000,
        restMs: 30_000,
        group: { label: 'A', set: 1, sets: 2 },
      },
      {
        index: 2,
        label: 'Thrusters',
        workMs: 45_000,
        group: { label: 'A', set: 2, sets: 2 },
      },
    ])
  })

  it('leaves a single-block workout with nothing to break down', () => {
    const t = compile({ mode: 'amrap', durationMs: 10 * MIN })
    expect(buildSplits(t, t.totalMs)).toHaveLength(1)
  })
})

describe('splitStats', () => {
  const splits = [
    { index: 1, workMs: 60_000, restMs: 60_000 },
    { index: 2, workMs: 70_000, restMs: 70_000 },
    { index: 3, workMs: 20_000, partial: true },
  ]

  it('summarises completed rounds and total volume', () => {
    expect(splitStats(splits)).toEqual({
      rounds: 2,
      totalWorkMs: 150_000,
      totalRestMs: 130_000,
      bestMs: 60_000,
      averageMs: 65_000,
    })
  })

  it('has no best or average before the first round closes', () => {
    expect(splitStats([{ index: 1, workMs: 5000, partial: true }])).toMatchObject({
      rounds: 0,
      bestMs: null,
      averageMs: null,
    })
  })
})

describe('splitDeltaMs', () => {
  const splits = [
    { index: 1, workMs: 60_000 },
    { index: 2, workMs: 64_000 },
    { index: 3, workMs: 64_500 },
    { index: 4, workMs: 30_000, partial: true },
  ]

  it('compares a round to the one before it', () => {
    expect(splitDeltaMs(splits, 1)).toBe(4000)
  })

  it('stays quiet on the first round, sub-second drift, and partial rounds', () => {
    expect(splitDeltaMs(splits, 0)).toBeNull()
    expect(splitDeltaMs(splits, 2)).toBeNull()
    expect(splitDeltaMs(splits, 3)).toBeNull()
  })
})
