# Dynamic-rest ("1:1") intervals — design

Date: 2026-07-04
Status: approved (pre-implementation)

## Problem

Some interval workouts are programmed with rest proportional to work — e.g.
"6 × 250m row, rest 1:1". The work duration is effort-based and unknown up
front, so today's Interval mode (fixed work / fixed rest) can't time them.
The athlete needs to tap a button when a round's work is finished; the rest
that follows must last exactly the work time multiplied by a chosen ratio.

## Decisions (confirmed with user)

- **Work phase**: open clock counting up, no preset duration. A DONE tap ends it.
- **Rest phase**: counts down for `work time × ratio`.
- **Ratios**: selectable — work:rest 2:1 (×0.5), 1:1 (×1), 1:2 (×2).
- **Rounds**: fixed count set in setup. The workout ends on the final round's
  DONE tap; no trailing rest (matches existing interval behavior).
- **Setup UI**: a sixth mode chip labeled "1:1" in the mode row (not a toggle
  inside Intervals).
- **Engine approach**: lap events + pure recompile (Approach A below).

## Approach

The engine stays event-sourced. A new `lap` event records each DONE tap in the
persisted event log, and the compiled timeline becomes a pure function of
`(config, lapOffsets(events))`. Every consumer — view computation, cue
scheduling, segment bar, crash-restore — continues to read
`(compiled, events, now)`.

Rejected alternatives:

- *Separate runtime state machine for this mode* — forks view/cues/restore
  into two code paths; double the timing-bug surface.
- *Mutating compiled segment durations on tap* — compiled state would no longer
  be derivable from config + events; restore would need a second persisted
  structure.

## 1. Config & types (`engine/types.ts`)

- `TimerConfig` gains an additive variant:
  `{ mode: 'ratioInterval'; ratio: number; rounds: number }`
  where `ratio` = rest ÷ work ∈ {0.5, 1, 2}. The existing `interval` variant
  is untouched — saved presets and synced rows never migrate.
- `TimerMode` gains `'ratioInterval'`.
- `TimerEvent` gains `{ type: 'lap'; at: number }`.
- `Segment` gains optional `open?: boolean` — a work segment whose end is not
  yet known.

## 2. Compile (`engine/compile.ts`)

New signature: `compile(config, prepMs?, lapOffsetsMs?: number[])`.
`lapOffsetsMs` are in the active-time domain (same as `segment.startMs`,
prep included).

For `ratioInterval`:

- For each recorded lap `i` (round `i+1`): emit a closed work segment with
  `durationMs = lapOffset − cursor`, then a rest segment of
  `workDuration × ratio` — skipped when the lap closed the final round.
- If rounds remain, emit exactly one open work segment for the current round:
  `open: true`, `durationMs = OPEN_CAP_MS` (4 hours, safety cap). No future
  placeholder segments are emitted.
- After the final lap there is no open segment, so `totalMs` equals the final
  lap offset and the existing `rawElapsed >= totalMs` check marks the workout
  done with no new runtime logic.

Cues:

- Open segments: keep the `go` start cue; suppress 3-2-1 end ticks (end
  unknown; also avoids cues at the fake 4h cap boundary).
- Lap-born rest segments: no compiled `transition` start cue — the tap plays
  it imperatively (§4). Rationale: after a recompile the runner resets its
  cue cursors to "now", deliberately never replaying cues at-or-before the
  current elapsed time, so a compiled cue at exactly the lap offset would be
  swallowed.
- Rest segments keep 3-2-1 end ticks and the next round's `go` fires at rest
  end as usual.
- The compiled `finish` cue at `totalMs` is likewise swallowed after the final
  lap's recompile; the store plays `finish` imperatively on that tap.

## 3. Runtime (`engine/runtime.ts`)

One new pure helper:

```ts
lapOffsets(events: TimerEvent[]): number[]
```

Folds the event log sequentially (same accumulation as `activeElapsed`) and
records the active elapsed time at each `lap` event. Laps interleaved with
pauses are correct by construction. `computeView` is unchanged.

## 4. Store (`timerStore.ts`)

- `start` and `restoreFromDb` compile with `lapOffsets(events)`. Crash/reload
  restore is automatic replay — nothing new is persisted (`activeSession`
  already stores config + events as JSON).
- New action `lap()`:
  - Guards: phase is `running`, current segment has `open: true`, and
    `segmentElapsedMs >= 1000` (double-tap protection).
  - Appends `{ type: 'lap', at: Date.now() }`, recompiles, persists, updates
    the view.
  - Immediately plays the `transition` cue + vibration — or `finish` cue +
    finish vibration when the tap closed the last round — via the audio
    engine, honoring the sound/vibrate settings.

## 5. Run screen (`TimerRunScreen.tsx`)

- During an open work segment the digits count **up**
  (`formatClock(segmentElapsedMs)`); rest counts down as today.
- Footer during open work: PAUSE plus a work-colored button — **ROUND DONE**,
  or **FINISH** on the final round (same styling as For Time's FINISH).
  Hidden while paused and during prep/rest.
- The "next:" hint hides the duration when the next segment is open.
- The 10-second final-stretch alarm pulse simply never triggers in this mode
  (total is unknown until the end); acceptable.
- Done screen: unchanged. Log-it uses `resultType: 'none'`, consistent with
  Interval mode.

## 6. Segment bar (`SegmentBar.tsx`)

Proportional widths are impossible with unknown durations. For
`ratioInterval` the bar renders `2 × rounds − 1` equal-width slots
(work/rest alternating): completed slots fully filled, the current rest fills
by its real fraction, the current open work slot shows a soft pulse, future
slots are empty.

## 7. Setup screen, describe, presets

- Sixth mode chip in the mode row, labeled **1:1**
  (`MODE_LABELS.ratioInterval = '1:1'`).
- Mode hint: "Work until you tap Round Done; rest matches your work time at
  the ratio you pick."
- Controls: ratio chips **2:1 / 1:1 / 1:2** (work:rest, default 1:1) and the
  existing Rounds stepper (default 6).
- `describe()` → `` `${rounds} rounds · rest ${ratioLabel}` `` with
  `ratioLabel` ∈ {"2:1", "1:1", "1:2"}.
- The footer omits "· total …" for this mode (total is unknown up front).
- Presets save/load unchanged (config is stored as JSON). A `ratioInterval`
  preset synced to an old app version won't render until the PWA
  auto-updates — accepted.
- A new preset helper `ratioInterval(rounds, ratio)` in `engine/presets.ts`.

## 8. Edge cases

- **Double tap**: 1s minimum segment age before a lap registers.
- **Tap while paused / during prep or rest**: button not rendered; `lap()`
  guard also rejects.
- **Abandoned session**: the 4h open-work cap eventually ends the timeline;
  `restoreFromDb` already discards done sessions.
- **Pause during open work**: allowed; lap offsets are pause-aware via the
  event-log fold.

## 9. Testing

- `compile.test.ts`: each ratio value; no rest after final round; open segment
  shape (open flag, cap duration, position); cue suppression rules (no 3-2-1
  on open segments, no transition cue on lap-born rests); `totalMs` equals
  last lap offset after the final lap; determinism (same inputs → same
  timeline).
- `runtime.test.ts`: `lapOffsets` with pauses before/between/after laps;
  view is `done` after the final lap; open-segment view counts up.
- Manual: gym-floor iPhone run — silent-switch cue flash, background/return
  mid-rest, reload mid-workout restore.

## Out of scope (follow-ups)

- Per-round split times on the done screen (data already in the event log).
- Open-ended round counts.
- Ratios beyond the three chips.
