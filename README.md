# WOD Time

Mobile-first PWA for CrossFit athletes: gym-floor timers, workout log,
1RM percentage tables, and an auto-computed daily weight sheet — no
whiteboard math.

**Local-first.** Everything works instantly with no account (IndexedDB).
Signing in with a magic link backs data up to Supabase and syncs it across
devices with last-write-wins merging.

## Features

- **Timers** — For Time (cap), AMRAP, EMOM, Intervals, 1:1, and a **Custom
  chipper**: chain heterogeneous, named blocks (Work/Rest/AMRAP/EMOM/Interval)
  into one workout that runs end to end, with one-tap starter templates. One
  engine: every mode compiles to a segment list with 3-2-1 beeps,
  sample-accurate Web Audio cues, wake lock, vibration, and a visual flash for
  iOS silent mode. Drift-free: state derives from wall-clock event logs, so
  backgrounding, phone calls, and even page reloads can't lose a workout
  ("Resume" is automatic).
- **Today's weights** — enter `5×3 Back Squat @ 75%` once; loads are computed
  from your stored 1RMs and rounded to what you can actually put on a bar.
  Blocks aren't just straight sets: build **waves** (per-set percentages, with
  a generator), **supersets** (A1/A2 lifts, each off its own 1RM),
  **complexes** (name a movement sequence), and add **tempo + notes**.
- **Lifts** — append-only 1RM history (PR progression for free), instant
  50–100% tables, custom percentages, kg/lbs with plate-aware rounding.
- **Log** — month-grouped history. Every finished timer auto-saves (a rolling
  last-15 safety net, tagged `auto`); tap **Add details** to enrich one into a
  permanent entry. Any entry is fully editable.
- **Today's weights** — a one-tap **Reset day** clears the whole sheet.

## Development

```bash
npm install
npm run dev        # vite --host (test on your phone over LAN)
npm test           # vitest — engine, units, merge logic
npm run build      # typecheck + production build (PWA)
```

Open on your phone: run `npm run dev`, then visit the LAN URL vite prints.

## Cloud sync setup (optional)

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema: paste `supabase/migrations/0001_init.sql` into the SQL
   editor (or `supabase db push` with the CLI).
3. Copy `.env.local.example` to `.env.local` and fill in the project URL and
   anon key (Project Settings → API).
4. Enable the Email provider (magic links) under Authentication → Providers,
   and add your dev/prod URLs to Authentication → URL Configuration.

Without `.env.local` the app runs fully offline — the Account section in
Settings simply stays dormant.

## Deploy (Vercel)

```bash
npx vercel         # framework: Vite, build: npm run build, output: dist
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project
env. `vercel.json` already rewrites client routes to `index.html`.

## Architecture

- `src/features/timer/engine/` — pure timer core: `compile.ts` (any config →
  segments + cues), `runtime.ts` (event-log fold; correct after any gap).
- `src/lib/db/` — Dexie schema (versioned migrations) and the sync envelope
  every synced row carries: client UUID, `updatedAt`, tombstone `deletedAt`,
  `dirty` flag.
- `src/lib/sync/` — `merge.ts` (pure LWW, tested), `engine.ts`
  (pull-then-push per table, paged cursors, idempotent upserts),
  `supabase.ts` (env-gated client).
- `supabase/migrations/` — Postgres schema with owner-only RLS on every
  table; teams/leaderboards land as additive migrations (`team_id` columns,
  `teams` table) without reworking v1 data.
- Pure logic (`engine/`, `lib/units/`, `computeSheet`, `percentTable`,
  `merge`) imports nothing from React/Dexie/Supabase and carries the tests.

## Roadmap

- SugarWOD daily-WOD pull (official API, per-gym key via a Supabase Edge
  Function proxy).
- Teams: shared WODs, leaderboards, streaks — schema is already
  multi-tenant-ready (client UUIDs, `user_id` on every row, RLS).
- Hebrew/RTL: all M3+ strings already go through `src/lib/i18n/t()`.
