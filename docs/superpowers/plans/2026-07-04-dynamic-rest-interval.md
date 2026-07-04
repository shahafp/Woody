# Dynamic-Rest ("1:1") Interval Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `ratioInterval` timer mode where work is an open count-up clock ended by a ROUND DONE tap and the following rest counts down for exactly `work time × ratio` (2:1, 1:1, or 1:2), over a fixed number of rounds.

**Architecture:** The timer engine stays event-sourced. A new `lap` event records each DONE tap in the persisted event log; the compiled timeline is a pure function of `(config, lapOffsets(events))` and is recompiled on every lap. All consumers (view computation, cue scheduler, segment bar, crash-restore) keep reading `(compiled, events, now)`. Cues at the tap instant are played imperatively because the runner never replays cues at-or-before the current elapsed time after a recompile.

**Tech Stack:** React 19 + TypeScript (strict), Zustand, Dexie, Vitest, Tailwind v4. Test with `npx vitest run <file>`; typecheck with `npm run typecheck`.

**Spec:** `docs/superpowers/specs/2026-07-04-dynamic-rest-interval-design.md`

**Conventions:** 2-space indent, no semicolons, single quotes (match surrounding code). All paths relative to repo root `/Users/shahafpariente/Desktop/SideKicks/wod-time`.

---

## File map

| File | Change |
|---|---|
| `src/features/timer/engine/types.ts` | Add `ratioInterval` config variant, `lap` event, `Segment.open` flag |
| `src/features/timer/engine/presets.ts` | `ratioInterval()` helper, `ratioLabel()`, mode label, `describe()` case |
| `src/features/timer/engine/presets.test.ts` | **New** — preset/describe tests |
| `src/features/timer/engine/runtime.ts` | `lapOffsets()` helper; make `activeElapsed()` ignore `lap` events |
| `src/features/timer/engine/runtime.test.ts` | lapOffsets + ratio-timeline view tests |
| `src/features/timer/engine/compile.ts` | Third param `lapOffsetsMs`, `ratioInterval` case, `OPEN_CAP_MS`, cue rules |
| `src/features/timer/engine/compile.test.ts` | ratioInterval compile + cue tests |
| `src/features/timer/timerStore.ts` | `lap()` action, imperative tap cue, lap-aware restore |
| `src/features/timer/TimerRunScreen.tsx` | Count-up digits on open work, ROUND DONE / FINISH button, next-hint fix |
| `src/features/timer/components/SegmentBar.tsx` | Equal-slot branch for `ratioInterval` |
| `src/features/timer/TimerSetupScreen.tsx` | Sixth "1:1" mode chip, ratio chips, rounds stepper, footer total omitted |

---

### Task 1: Types + presets (`ratioInterval` config variant)

The config variant, mode label, and describe() must land together — `MODE_LABELS` is a `Record<TimerMode, string>` and `describe()` is an exhaustive switch, so adding the mode to `TimerMode` alone breaks `npm run typecheck`.

**Files:**
- Test: `src/features/timer/engine/presets.test.ts` (new)
- Modify: `src/features/timer/engine/types.ts`
- Modify: `src/features/timer/engine/presets.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/timer/engine/presets.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { describe as describeConfig, ratioInterval, ratioLabel } from './presets'

describe('ratioInterval preset', () => {
  it('builds the config; ratio is rest ÷ work', () => {
    expect(ratioInterval(6, 1)).toEqual({ mode: 'ratioInterval', ratio: 1, rounds: 6 })
    expect(ratioInterval(4, 0.5)).toEqual({ mode: 'ratioInterval', ratio: 0.5, rounds: 4 })
  })

  it('labels ratios as work:rest', () => {
    expect(ratioLabel(0.5)).toBe('2:1')
    expect(ratioLabel(1)).toBe('1:1')
    expect(ratioLabel(2)).toBe('1:2')
  })

  it('describes the workout', () => {
    expect(describeConfig(ratioInterval(6, 2))).toBe('6 rounds · rest 1:2')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/timer/engine/presets.test.ts`
Expected: FAIL — `ratioInterval` / `ratioLabel` have no exported member.

- [ ] **Step 3: Implement types**

In `src/features/timer/engine/types.ts`:

Change line 1:

```ts
export type TimerMode = 'forTime' | 'amrap' | 'emom' | 'interval' | 'ratioInterval' | 'custom'
```

In `TimerConfig`, add a variant after the `interval` line:

```ts
export type TimerConfig =
  | { mode: 'forTime'; capMs: number }
  | { mode: 'amrap'; durationMs: number }
  | { mode: 'emom'; intervalMs: number; rounds: number }
  | { mode: 'interval'; workMs: number; restMs: number; rounds: number }
  /** Open-clock work ended by a lap tap; rest = work × ratio (ratio = rest ÷ work). */
  | { mode: 'ratioInterval'; ratio: number; rounds: number }
  | { mode: 'custom'; rounds: number; steps: CustomStep[] }
```

In `TimerEvent`, add the lap variant:

```ts
export type TimerEvent =
  | { type: 'start'; at: number }
  | { type: 'pause'; at: number }
  | { type: 'resume'; at: number }
  /** DONE tap closing the current open work segment (ratioInterval). */
  | { type: 'lap'; at: number }
  | { type: 'finish'; at: number }
```

In `Segment`, add after `totalRounds: number`:

```ts
  /** Work segment whose end isn't known yet — awaiting a lap. */
  open?: boolean
```

- [ ] **Step 4: Implement presets**

In `src/features/timer/engine/presets.ts`, add after the `interval()` function:

```ts
export function ratioInterval(rounds: number, ratio = 1): TimerConfig {
  return { mode: 'ratioInterval', ratio, rounds }
}

/** work:rest label for a rest ÷ work multiplier. */
export function ratioLabel(ratio: number): string {
  if (ratio === 0.5) return '2:1'
  if (ratio === 2) return '1:2'
  return '1:1'
}
```

In `MODE_LABELS`, add after the `interval` entry:

```ts
  ratioInterval: '1:1',
```

In `describe()`, add a case after `case 'interval':`'s return:

```ts
    case 'ratioInterval':
      return `${config.rounds} rounds · rest ${ratioLabel(config.ratio)}`
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/timer/engine/presets.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: clean. (`TimerSetupScreen` still compiles — its `mode === 'interval' ? … : custom` ternary chain stays type-valid; the new mode gets real setup UI in Task 8.)

- [ ] **Step 7: Commit**

```bash
git add src/features/timer/engine/types.ts src/features/timer/engine/presets.ts src/features/timer/engine/presets.test.ts
git commit -m "feat(timer): ratioInterval config variant, lap event, open-segment flag"
```

---

### Task 2: `lapOffsets()` + lap-transparent `activeElapsed()`

`activeElapsed()` folds the event log with "anything that isn't start/resume closes the running span" — a `lap` event would silently freeze the clock. It must skip laps. `lapOffsets()` converts each lap's wall-clock timestamp to the active-time domain (same domain as `Segment.startMs`, prep included, pauses excluded).

**Files:**
- Modify: `src/features/timer/engine/runtime.ts`
- Test: `src/features/timer/engine/runtime.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/features/timer/engine/runtime.test.ts`, update the runtime import to include `lapOffsets`:

```ts
import { activeElapsed, computeView, cuesInWindow, lapOffsets } from './runtime'
```

Add inside `describe('activeElapsed', …)`:

```ts
  it('ignores lap events — the clock keeps running through a tap', () => {
    const events = ev(['start', 0], ['lap', 40_000])
    expect(activeElapsed(events, T0 + 60_000)).toBe(60_000)
  })
```

Add a new top-level describe block:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/timer/engine/runtime.test.ts`
Expected: FAIL — `lapOffsets` is not exported; the `ignores lap events` test returns 40_000 instead of 60_000.

- [ ] **Step 3: Implement**

In `src/features/timer/engine/runtime.ts`, add as the first line of the `for` loop body in `activeElapsed()`:

```ts
    if (e.type === 'lap') continue
```

so the loop reads:

```ts
  for (const e of events) {
    if (e.type === 'lap') continue
    if (e.type === 'start' || e.type === 'resume') {
      if (runningSince === null) runningSince = e.at
    } else if (runningSince !== null) {
      elapsed += e.at - runningSince
      runningSince = null
    }
  }
```

Add after `isPaused()`:

```ts
/**
 * Active-time offsets (same domain as Segment.startMs) of each lap event.
 * Pause-aware by construction: the same fold as activeElapsed, sampled at
 * each lap.
 */
export function lapOffsets(events: TimerEvent[]): number[] {
  const offsets: number[] = []
  let elapsed = 0
  let runningSince: number | null = null
  for (const e of events) {
    if (e.type === 'lap') {
      offsets.push(elapsed + (runningSince !== null ? e.at - runningSince : 0))
    } else if (e.type === 'start' || e.type === 'resume') {
      if (runningSince === null) runningSince = e.at
    } else if (runningSince !== null) {
      elapsed += e.at - runningSince
      runningSince = null
    }
  }
  return offsets
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/timer/engine/runtime.test.ts`
Expected: PASS (all, including pre-existing).

- [ ] **Step 5: Commit**

```bash
git add src/features/timer/engine/runtime.ts src/features/timer/engine/runtime.test.ts
git commit -m "feat(timer): lapOffsets helper; activeElapsed ignores lap events"
```

---

### Task 3: Compile `ratioInterval` timelines

`compile()` gains a third parameter with the lap history. Each recorded lap closes a work segment and (except after the final round) appends a rest of `work × ratio`. If rounds remain, exactly one open work segment follows, capped at 4 hours as a safety net; no future placeholders. After the final lap `totalMs` equals that lap's offset, so the existing `rawElapsed >= totalMs` done-check needs no change.

Cue rules for this mode: work segments get their `go` start cue but **no 3-2-1 end ticks** (an open segment's end is unknown; a closed one's end is always already in the past — dead cues). Rest segments get **no `transition` start cue** (the tap plays it imperatively — a compiled cue at exactly the lap offset would be swallowed by the runner's never-replay-the-past guard) but keep their 3-2-1 count-in to the next round.

**Files:**
- Modify: `src/features/timer/engine/compile.ts`
- Test: `src/features/timer/engine/compile.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/features/timer/engine/compile.test.ts`, update the import:

```ts
import { compile, OPEN_CAP_MS } from './compile'
```

Add a new top-level describe block:

```ts
describe('compile ratioInterval', () => {
  it('no laps: prep + one open work segment at the safety cap', () => {
    const t = compile({ mode: 'ratioInterval', ratio: 1, rounds: 6 })
    expect(t.segments).toHaveLength(2)
    expect(t.segments[1]).toMatchObject({
      kind: 'work', open: true, label: 'Work 1/6', startMs: 10_000, durationMs: OPEN_CAP_MS, round: 1,
    })
    expect(t.totalMs).toBe(10_000 + OPEN_CAP_MS)
  })

  it('one lap at 1:1: closed work, equal rest, next open work', () => {
    const t = compile({ mode: 'ratioInterval', ratio: 1, rounds: 6 }, 10_000, [117_000])
    expect(t.segments.map((s) => s.kind)).toEqual(['prep', 'work', 'rest', 'work'])
    expect(t.segments[1]).toMatchObject({ startMs: 10_000, durationMs: 107_000, round: 1 })
    expect(t.segments[1].open).toBeUndefined()
    expect(t.segments[2]).toMatchObject({ kind: 'rest', startMs: 117_000, durationMs: 107_000, round: 1 })
    expect(t.segments[3]).toMatchObject({ kind: 'work', open: true, startMs: 224_000, round: 2 })
  })

  it('ratio scales rest: ×0.5 and ×2', () => {
    const half = compile({ mode: 'ratioInterval', ratio: 0.5, rounds: 3 }, 0, [100_000])
    expect(half.segments[1]).toMatchObject({ kind: 'rest', durationMs: 50_000 })
    const dbl = compile({ mode: 'ratioInterval', ratio: 2, rounds: 3 }, 0, [100_000])
    expect(dbl.segments[1]).toMatchObject({ kind: 'rest', durationMs: 200_000 })
  })

  it('no rest after the final round; totalMs = final lap offset', () => {
    const t = compile({ mode: 'ratioInterval', ratio: 1, rounds: 2 }, 0, [60_000, 150_000])
    // work1 60s, rest1 60s, work2 = 150 − 120 = 30s, nothing after
    expect(t.segments.map((s) => s.kind)).toEqual(['work', 'rest', 'work'])
    expect(t.segments[2]).toMatchObject({ durationMs: 30_000 })
    expect(t.segments[2].open).toBeUndefined()
    expect(t.totalMs).toBe(150_000)
  })

  it('cues: go on every work start, no 3-2-1 on work, no transition on rest', () => {
    const t = compile({ mode: 'ratioInterval', ratio: 1, rounds: 3 }, 0, [60_000])
    expect(t.cues.filter((c) => c.sound === 'transition')).toHaveLength(0)
    expect(t.cues.filter((c) => c.sound === 'go').map((c) => c.atMs)).toEqual([0, 120_000])
    // only ticks: the rest segment counting into round 2
    expect(t.cues.filter((c) => c.sound === 'tick').map((c) => c.atMs)).toEqual([
      117_000, 118_000, 119_000,
    ])
  })

  it('existing modes keep their transition cues', () => {
    const t = compile({ mode: 'interval', workMs: 40_000, restMs: 20_000, rounds: 2 }, 0)
    expect(t.cues.filter((c) => c.sound === 'transition')).toHaveLength(1)
  })

  it('same laps → identical timeline (restore is pure replay)', () => {
    const a = compile({ mode: 'ratioInterval', ratio: 1, rounds: 4 }, 10_000, [70_000, 200_000])
    const b = compile({ mode: 'ratioInterval', ratio: 1, rounds: 4 }, 10_000, [70_000, 200_000])
    expect(b).toEqual(a)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/timer/engine/compile.test.ts`
Expected: FAIL — `OPEN_CAP_MS` not exported; ratioInterval case missing (TS may refuse to compile the switch — that counts as the failing state).

- [ ] **Step 3: Implement**

In `src/features/timer/engine/compile.ts`:

Add below `DEFAULT_PREP_MS`:

```ts
/** Safety cap for an open work segment — ends an abandoned session eventually. */
export const OPEN_CAP_MS = 4 * 60 * 60_000
```

Change the signature and the `push` helper to support open segments:

```ts
export function compile(
  config: TimerConfig,
  prepMs = DEFAULT_PREP_MS,
  lapOffsetsMs: number[] = [],
): CompiledTimer {
  const segments: Segment[] = []
  let cursor = 0

  const push = (
    kind: Segment['kind'],
    label: string,
    durationMs: number,
    round: number,
    totalRounds: number,
    open = false,
  ) => {
    segments.push({
      index: segments.length,
      kind,
      label,
      startMs: cursor,
      durationMs,
      round,
      totalRounds,
      ...(open ? { open: true } : {}),
    })
    cursor += durationMs
  }
```

Add the case after `case 'interval':`'s block:

```ts
    case 'ratioInterval': {
      const laps = lapOffsetsMs.slice(0, config.rounds)
      laps.forEach((lapMs, i) => {
        const r = i + 1
        const workMs = Math.max(0, lapMs - cursor)
        push('work', `Work ${r}/${config.rounds}`, workMs, r, config.rounds)
        if (r < config.rounds) {
          push('rest', `Rest ${r}/${config.rounds}`, Math.round(workMs * config.ratio), r, config.rounds)
        }
      })
      if (laps.length < config.rounds) {
        const r = laps.length + 1
        push('work', `Work ${r}/${config.rounds}`, OPEN_CAP_MS, r, config.rounds, true)
      }
      break
    }
```

Change the `buildCues` call in the return statement:

```ts
    cues: buildCues(segments, cursor, config.mode === 'ratioInterval'),
```

Change `buildCues` to take and honor the flag:

```ts
function buildCues(segments: Segment[], totalMs: number, dynamicWork: boolean): Cue[] {
  const cues: Cue[] = []
  for (const seg of segments) {
    const end = seg.startMs + seg.durationMs
    // 3-2-1 ticks announcing whatever comes at this segment's end.
    // Skipped for dynamic work segments: an open end is unknown, and a
    // closed one is always already in the past.
    const skipTicks = seg.open === true || (dynamicWork && seg.kind === 'work')
    if (seg.durationMs >= 4000 && !skipTicks) {
      for (const back of [3000, 2000, 1000]) {
        cues.push({ atMs: end - back, sound: 'tick' })
      }
    }
    if (seg.kind === 'work') {
      cues.push({ atMs: seg.startMs, sound: 'go', vibrate: [200] })
    } else if (seg.kind === 'rest' && !dynamicWork) {
      // Dynamic rests start at the lap tap, which plays the cue imperatively.
      cues.push({ atMs: seg.startMs, sound: 'transition', vibrate: [100, 80, 100] })
    }
  }
  cues.push({ atMs: totalMs, sound: 'finish', vibrate: [600, 150, 600] })
```

(The dedupe/sort tail of `buildCues` is unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/timer/engine/compile.test.ts`
Expected: PASS — the 7 new tests and all 8 pre-existing ones.

- [ ] **Step 5: Commit**

```bash
git add src/features/timer/engine/compile.ts src/features/timer/engine/compile.test.ts
git commit -m "feat(timer): compile ratioInterval timelines from lap history"
```

---

### Task 4: View behavior on ratio timelines (verification tests)

`computeView` needs **no changes** — these tests pin down that the composition works: open work reads as running and counts up, rest counts down with the matched duration, and the final lap ends the workout. If any fail, fix the engine, not the tests.

**Files:**
- Test: `src/features/timer/engine/runtime.test.ts`

- [ ] **Step 1: Add the tests**

Add a new top-level describe block in `src/features/timer/engine/runtime.test.ts`:

```ts
describe('computeView on ratioInterval timelines', () => {
  const cfg = { mode: 'ratioInterval', ratio: 1, rounds: 2 } as const

  it('open work is running and elapses upward', () => {
    const t = compile(cfg, 10_000, [])
    const v = computeView(t, ev(['start', 0]), T0 + 40_000)
    expect(v.phase).toBe('running')
    expect(v.segment?.open).toBe(true)
    expect(v.segmentElapsedMs).toBe(30_000)
    expect(v.round).toBe(1)
  })

  it('after a lap the athlete rests with the matched countdown', () => {
    const t = compile(cfg, 10_000, [70_000]) // work1 = 60s → rest1 = 60s
    const events = ev(['start', 0], ['lap', 70_000])
    const v = computeView(t, events, T0 + 100_000)
    expect(v.segment?.kind).toBe('rest')
    expect(v.segmentRemainingMs).toBe(30_000)
  })

  it('done immediately after the final lap; result excludes prep', () => {
    const t = compile(cfg, 10_000, [70_000, 200_000])
    const events = ev(['start', 0], ['lap', 70_000], ['lap', 200_000])
    const v = computeView(t, events, T0 + 200_000)
    expect(v.phase).toBe('done')
    expect(v.finishedWorkMs).toBe(190_000)
  })
})
```

- [ ] **Step 2: Run tests — expected to pass immediately**

Run: `npx vitest run src/features/timer/engine/runtime.test.ts`
Expected: PASS. If a test fails, the engine composition is wrong — debug `compile`/`computeView`, don't adjust the expectations.

- [ ] **Step 3: Commit**

```bash
git add src/features/timer/engine/runtime.test.ts
git commit -m "test(timer): pin computeView behavior on ratioInterval timelines"
```

---

### Task 5: Store — `lap()` action, imperative tap cue, lap-aware restore

The tap must (1) append the event, (2) recompile with the new lap history, (3) play the transition cue **immediately** — after a recompile the runner resets its cue cursors to "now" and deliberately never replays cues at-or-before the current elapsed time, so a compiled cue at the lap offset would be silent. When the tap closes the final round, play `finish` instead. Vibration patterns match the compiled cues (`transition: [100, 80, 100]`, `finish: [600, 150, 600]`).

There are no store unit tests in this codebase (Zustand + Dexie + Web Audio); correctness here is covered by the engine tests plus Task 9's manual pass.

**Files:**
- Modify: `src/features/timer/timerStore.ts`

- [ ] **Step 1: Update imports**

```ts
import { create } from 'zustand'
import { db } from '@/lib/db/db'
import { useSettingsStore } from '@/features/settings/settingsStore'
import {
  audioNow,
  cancelScheduledCues,
  scheduleCue,
  unlockAudio,
} from './audio/audioEngine'
import { compile, DEFAULT_PREP_MS } from './engine/compile'
import { computeView, lapOffsets } from './engine/runtime'
import type {
  CompiledTimer,
  CueSound,
  TimerConfig,
  TimerEvent,
  TimerView,
} from './engine/types'
```

(Check `settingsStore.ts` does not import from the timer feature — it doesn't today — to avoid an import cycle.)

- [ ] **Step 2: Add the action to the interface**

In `interface TimerState`, after `resume: () => void`:

```ts
  /** DONE tap: close the current open work segment (ratioInterval). */
  lap: () => void
```

- [ ] **Step 3: Add the tap-feedback helper**

Below the `persist` function:

```ts
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
```

- [ ] **Step 4: Add the `lap` action**

After `resume` in the store body:

```ts
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
    set({
      compiled: recompiled,
      events: next,
      view: computeView(recompiled, next, Date.now()),
    })
  },
```

- [ ] **Step 5: Make restore lap-aware**

In `restoreFromDb`, change:

```ts
    const compiled = compile(row.config)
```

to:

```ts
    const compiled = compile(row.config, DEFAULT_PREP_MS, lapOffsets(row.events))
```

- [ ] **Step 6: Typecheck and full test run**

Run: `npm run typecheck && npx vitest run`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add src/features/timer/timerStore.ts
git commit -m "feat(timer): lap action with imperative tap cue and lap-aware restore"
```

---

### Task 6: Run screen — count-up digits, ROUND DONE / FINISH button

**Files:**
- Modify: `src/features/timer/TimerRunScreen.tsx`

- [ ] **Step 1: Wire the action and the open-work flag**

Add with the other store selectors (after the `finish` line):

```tsx
  const lap = useTimerStore((s) => s.lap)
```

After the `const { phase, segment } = view` line, add:

```tsx
  const openWork = phase === 'running' && segment?.open === true
```

- [ ] **Step 2: Count up during open work**

Replace the `digits` expression:

```tsx
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
```

- [ ] **Step 3: Hide the duration in the next-hint for open segments**

In the `next:` IIFE, replace the returned span with:

```tsx
          return (
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-chalk-dim">
              next: {next.kind === 'rest' ? 'rest' : next.label}
              {next.open ? '' : ` ${formatClock(next.durationMs)}`}
            </span>
          )
```

- [ ] **Step 4: Add the button**

In the footer's non-done button row, after the existing `isForTime && …` FINISH button block, add:

```tsx
            {openWork && (
              <button
                type="button"
                onClick={lap}
                className="h-16 flex-1 rounded-2xl bg-work font-display text-2xl tracking-wider text-surface"
              >
                {view.round >= view.totalRounds ? 'FINISH' : 'ROUND DONE'}
              </button>
            )}
```

(`openWork` is false while paused and during prep/rest, so the button hides itself; the store guard is the backstop.)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/timer/TimerRunScreen.tsx
git commit -m "feat(timer): run screen count-up work clock and ROUND DONE button"
```

---

### Task 7: Segment bar — equal-slot rendering for ratio intervals

Proportional widths are meaningless when future durations are unknown. For `ratioInterval` the bar shows `2 × rounds − 1` equal-width slots (work/rest alternating): completed slots full, the current rest fills by its real fraction, the current open work pulses at full fill, future slots empty.

**Files:**
- Modify: `src/features/timer/components/SegmentBar.tsx`

- [ ] **Step 1: Implement**

Replace the file body so `SegmentBar` branches and the new sub-component lives below (existing behavior for all other modes is byte-for-byte unchanged):

```tsx
import type { CompiledTimer } from '../engine/types'

const FILL: Record<string, string> = {
  prep: 'bg-chalk-dim',
  work: 'bg-work',
  rest: 'bg-rest',
}

/** Proportional segment strip showing position in the whole workout. */
export function SegmentBar({
  compiled,
  elapsedMs,
}: {
  compiled: CompiledTimer
  elapsedMs: number
}) {
  if (compiled.config.mode === 'ratioInterval') {
    return (
      <RatioSlotBar
        rounds={compiled.config.rounds}
        compiled={compiled}
        elapsedMs={elapsedMs}
      />
    )
  }
  // prep + a single work block has nothing to show
  if (compiled.segments.length <= 2) return null
  return (
    <div className="flex h-1.5 w-full gap-[2px]">
      {compiled.segments.map((s) => {
        const fill = Math.min(1, Math.max(0, (elapsedMs - s.startMs) / s.durationMs))
        return (
          <div
            key={s.index}
            style={{ flexGrow: s.durationMs }}
            className="relative overflow-hidden rounded-full bg-edge"
          >
            <div
              className={`absolute inset-y-0 left-0 ${FILL[s.kind]}`}
              style={{ width: `${fill * 100}%` }}
            />
          </div>
        )
      })}
    </div>
  )
}

/**
 * Durations are unknown up front, so slots are equal-width: done → full,
 * current rest → live fraction, current open work → pulsing full fill.
 */
function RatioSlotBar({
  rounds,
  compiled,
  elapsedMs,
}: {
  rounds: number
  compiled: CompiledTimer
  elapsedMs: number
}) {
  if (rounds <= 1) return null
  const placed = compiled.segments.filter((s) => s.kind !== 'prep')
  return (
    <div className="flex h-1.5 w-full gap-[2px]">
      {Array.from({ length: 2 * rounds - 1 }, (_, i) => {
        const kind = i % 2 === 0 ? 'work' : 'rest'
        const seg = placed[i]
        let fill = 0
        let pulse = false
        if (seg) {
          if (seg.open) {
            const active = elapsedMs >= seg.startMs
            fill = active ? 1 : 0
            pulse = active
          } else {
            fill = Math.min(1, Math.max(0, (elapsedMs - seg.startMs) / seg.durationMs))
          }
        }
        return (
          <div key={i} className="relative flex-1 overflow-hidden rounded-full bg-edge">
            <div
              className={`absolute inset-y-0 left-0 ${FILL[kind]} ${pulse ? 'animate-pulse' : ''}`}
              style={{ width: `${fill * 100}%` }}
            />
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean. (`compiled.config.rounds` narrows fine: the `mode === 'ratioInterval'` check discriminates the union.)

- [ ] **Step 3: Commit**

```bash
git add src/features/timer/components/SegmentBar.tsx
git commit -m "feat(timer): equal-slot segment bar for ratio intervals"
```

---

### Task 8: Setup screen — "1:1" mode chip, ratio chips, rounds

**Files:**
- Modify: `src/features/timer/TimerSetupScreen.tsx`

- [ ] **Step 1: Imports, mode list, hint**

Update the presets import:

```tsx
import { amrap, describe, forTime, interval, MODE_LABELS, ratioInterval, ratioLabel } from './engine/presets'
```

Update the mode list (the chip label comes from `MODE_LABELS.ratioInterval = '1:1'`):

```tsx
const MODES: TimerMode[] = ['forTime', 'amrap', 'emom', 'interval', 'ratioInterval', 'custom']
```

Add to `MODE_HINTS` after the `interval` entry:

```tsx
  ratioInterval: 'Work until you tap Round Done — rest matches your work time at the ratio you pick.',
```

- [ ] **Step 2: State, config, loadConfig**

Add state after the `intRounds` line:

```tsx
  const [ratioX, setRatioX] = useState(1)
  const [ratioRounds, setRatioRounds] = useState(6)
```

Extend the `config` ternary chain — replace the `interval` / `custom` tail with:

```tsx
          : mode === 'interval'
            ? interval(intRounds, intWorkSec, intRestSec)
            : mode === 'ratioInterval'
              ? ratioInterval(ratioRounds, ratioX)
              : { mode: 'custom', rounds: customRounds, steps: customSteps }
```

Add a case in `loadConfig` after the `interval` case:

```tsx
      case 'ratioInterval':
        setRatioX(c.ratio)
        setRatioRounds(c.rounds)
        break
```

- [ ] **Step 3: Mode UI block**

Add after the `{mode === 'interval' && (…)}` block:

```tsx
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
```

- [ ] **Step 4: Omit the meaningless total in the footer**

Replace:

```tsx
        <span>
          {describe(config)} · total {formatClock(workoutMs)}
        </span>
```

with:

```tsx
        <span>
          {describe(config)}
          {mode !== 'ratioInterval' && ` · total ${formatClock(workoutMs)}`}
        </span>
```

- [ ] **Step 5: Typecheck and full test run**

Run: `npm run typecheck && npx vitest run`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/timer/TimerSetupScreen.tsx
git commit -m "feat(timer): 1:1 mode setup with ratio chips and rounds"
```

---

### Task 9: Full verification

**Files:** none new — verification only.

- [ ] **Step 1: Full automated pass**

Run: `npx vitest run && npm run build`
Expected: all tests pass; `tsc --noEmit` inside `build` is clean; vite build succeeds.

- [ ] **Step 2: Manual smoke in the dev server**

Run: `npm run dev` and open the app. Verify on the Timer tab:

1. A **1:1** chip appears between Intervals and Custom; selecting it shows ratio chips (2:1 / 1:1 / 1:2) + Rounds, and the footer reads like `6 rounds · rest 1:1` with **no** "· total".
2. Start a 2-round 1:1 workout. After the 10s prep: digits count **up** in work color, ROUND DONE button visible.
3. Tap ROUND DONE at ~0:10 → transition sound + vibration, digits switch to a ~0:10 rest countdown, segment bar's first slot full and rest slot filling.
4. During rest, "next: Work 2/2" shows with **no duration**; 3-2-1 ticks fire at rest end, then `go`.
5. Round 2 shows **FINISH** instead of ROUND DONE (last round). Tapping it plays the finish sound and lands on the done screen (TIME = total elapsed since prep end).
6. Pause during open work freezes the count-up; RESUME continues; ROUND DONE is hidden while paused.
7. Mid-workout (during a rest), reload the page → session restores into the correct phase with the correct remaining rest.
8. Save a 1:1 preset, reload, load it via chip → mode, ratio, rounds restored.

- [ ] **Step 3: Commit anything outstanding**

```bash
git status --short
```

Expected: clean. If stragglers exist, commit them with an appropriate message.

---

## Self-review notes (already applied)

- **Spec coverage:** types/§1 → Task 1; compile/§2 → Task 3; runtime/§3 → Task 2; store/§4 → Task 5; run screen/§5 → Task 6; segment bar/§6 → Task 7; setup+describe+presets/§7 → Tasks 1, 8; edge cases/§8 → Tasks 3 (cap), 5 (guards), 6 (button visibility); testing/§9 → Tasks 2–4, 9.
- **Beyond spec (required by code reality):** `activeElapsed()` must skip `lap` events (Task 2) — otherwise a lap freezes the clock like a pause. The spec's "computeView unchanged" holds; this is in `activeElapsed`.
- **Cue-rule deviation from spec §2, deliberate:** spec says suppress 3-2-1 only on *open* segments; the plan suppresses them on **all** ratio-mode work segments — a closed work segment's end ticks are always in the past (the segment is closed *by* the lap at its end), so they'd be dead cues that only complicate the cue table and tests.
