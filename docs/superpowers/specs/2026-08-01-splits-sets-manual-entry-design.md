# Round splits, set blocks, and typable numbers — design

Date: 2026-08-01
Status: implemented

## Problem

Five gaps, all of them things a coach notices on the gym floor rather than in
the code:

1. A 1:1 session tells you nothing about the round you just finished — the
   whole point of dynamic-rest work is watching your round times drift.
2. History keeps the config and (for For Time) the final time. Everything the
   clock actually measured — round times, total time, whether you finished —
   is thrown away.
3. Setting a time means tapping −/+ five, ten, twenty times.
4. A workout that opens on a rest still burns a 10-second "Get ready"
   countdown in front of it, stretching the first break past what was written.
5. The chipper can chain blocks but can't repeat a run of them, so "3 sets of
   A1/A2" has to be pasted three times and re-edited three times.

## 1. Round splits (`engine/splits.ts`)

`buildSplits(compiled, elapsedMs): RoundSplit[]` — one entry per work segment
that started, carrying the rest that followed it. Pure over the compiled
timeline and active elapsed time, so the same call serves the live run screen,
the finish summary, and the log entry, and stays correct on a session restored
after a reload. A round the session ended inside is `partial`.

Compiler-generated labels (`Work 3/6`, `Min 3/10`) are dropped from the split —
the round number already carries that. Movement names and set-group tags are
kept, because they say something the number doesn't.

`splitStats` (rounds / total work / total rest / best / average) and
`splitDeltaMs` (this round vs the one before, null under a second) sit
alongside it. Deltas hide themselves on fixed-duration timelines, where every
round is identical by construction.

**Live (1:1 only):** a chip strip above the segment bar, plus `LAST ROUND 1:12
+0:03` under the round counter. Fixed modes don't get it — the round time is
already on the wall.

**Finish:** any session with more than one work segment gets the stats row and
the full table.

## 2. History keeps the detail

`WorkoutLogRow.result` gains three additive keys — `elapsedMs`, `splits`,
`completed` — carried inside the existing `result` JSONB. No Postgres
migration, no new sync mapping, and old clients ignore what they don't know.

- Every finished session records them (not just For Time).
- **Ending early is logged too.** Past `MIN_LOGGABLE_MS` (60s, the mis-tap
  threshold), the End button reads "Tap to save & end" and the session lands in
  the log with the rounds it got through and `completed: false`.
- The edit form rebuilds the *scored* result from its inputs but carries the
  timer-measured keys through untouched, so annotating an entry can't erase its
  splits.

## 3. Typable numbers (`components/EditableValue.tsx`)

Tap a value → it becomes a keyboard field; commit on Enter or blur, discard on
Escape. The parent parses and clamps, so anything unreadable leaves the value
put. Wired into `CompactStepper`, `MinutePicker`, and the WOD sheet's
`MiniField`, which covers every −/+ control in the app.

Parsing is keypad-friendly, since a numeric pad has no colon:

- Second fields: bare digits are seconds (`90` → 1:30); `1:30` also works.
- Minute dials: bare digits are minutes (`12` → 12:00); `7.5` and `7:30` also
  work (`parseMinutes`).
- Counts: whole numbers, with `%` and `+` forgiven (`parseCount`).

`MinutePicker` now holds milliseconds rather than whole minutes, so a 7:30
AMRAP is expressible at all.

## 4. No countdown in front of a rest

`startsWithRest(config)` — true when a composite workout's first block (or the
first child of a leading set block) is a rest, or a custom sequence's first
step is. `compile` skips the prep segment for those, and the setup screen says
so: "Starts on your rest — no countdown first."

## 5. Set blocks

`CompositeBlock` splits into `CompositeLeafBlock` (the five existing kinds) and
a new `CompositeGroupBlock`:

```ts
{ id, type: 'group', label?, sets, restBetweenSetsMs, children: CompositeLeafBlock[] }
```

One level deep on purpose — a set block holds leaves only, so the compiled
timeline stays readable on the run screen.

Compilation replays the children once per set and inserts
`restBetweenSetsMs` between sets, never after the last (0 = none). Children run
in the order written; no trailing-rest trimming inside a group, since the
between-sets rest is the explicit knob for that. Every segment from a group
carries `group: { label?, set, sets }`, which drives `SET 2/3` on the run
screen and the set headers in the splits table.

`blockMs()` gives the builder a per-block duration, so a block card shows what
it costs before you commit to it.

## Compatibility

- Timeline output for every pre-existing config is byte-identical; the added
  `Segment.group` is optional and absent unless a set block produced it.
- A `group` preset synced to an older client won't render until that PWA
  updates — the same accepted trade-off as `ratioInterval`.

## Testing

`compile.test.ts` (set expansion, between-sets rest, group stamping, nested
interval rounds, prep-skip rules), `splits.test.ts` (closed/partial rounds,
clipped rest, labels, stats, deltas), `presets.test.ts` (describe/duration/
stamping of set blocks), `format.test.ts` (the two new parsers). Manual: a full
1:1 session, a set-block session, and an early-ended session driven end to end
in a mobile-sized browser, checking the live strip, the finish summary, and
both log screens.
