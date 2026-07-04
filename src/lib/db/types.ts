import type { TimerConfig } from '@/features/timer/engine/types'
import type { Unit } from '@/lib/units/convert'

/**
 * Envelope for every synced table. Sync DTO changes must be ADDITIVE:
 * old clients ignore unknown fields, new clients default missing ones.
 *
 * - id: client-generated UUID (sync-safe, no server sequences)
 * - deletedAt: tombstone — rows are never hard-deleted until synced
 * - dirty: 1 when the row has local changes not yet pushed (M5 sync)
 */
export interface Row {
  id: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  dirty: 0 | 1
}

export interface LiftRow extends Row {
  name: string
  sortOrder: number
  isArchived: boolean
}

export interface LiftMaxRow extends Row {
  liftId: string
  /** Always stored in kg; display converts. */
  valueKg: number
  /** ISO date (yyyy-mm-dd) the max was set. */
  recordedAt: string
  source: 'manual' | 'log'
  notes: string | null
}

export interface SettingsRow extends Row {
  unit: Unit
  plateIncrementKg: number
  plateIncrementLbs: number
  soundEnabled: boolean
  vibrateEnabled: boolean
  locale: 'en'
}

/** One prescribed set: reps at a percentage of the movement's 1RM. */
export interface WodSheetSet {
  reps: number
  percent: number
}

/**
 * A lift performed for a list of sets. Varied per-set percents = a wave.
 * `label` overrides the display name for a complex (e.g. "Clean + FS + Jerk"),
 * where the percent is still computed off `liftId`'s 1RM.
 */
export interface WodSheetMovement {
  id: string
  liftId: string
  label?: string
  sets: WodSheetSet[]
}

export interface WodSheetBlock {
  id: string
  /** Legacy uniform fields — the source of truth when `movements` is absent, and
   * kept mirrored to the primary movement so pre-movements clients still render. */
  liftId: string
  sets: number
  reps: number
  percent: number
  /** Block/superset heading, e.g. "A". */
  label?: string
  /** The real content when present: one movement = straight/wave, many = superset. */
  movements?: WodSheetMovement[]
  /** Tempo prescription, e.g. "31X1". */
  tempo?: string
  /** Short coaching cue. */
  note?: string
}

/** One day's strength work — blocks are edited and synced as a unit (JSONB). */
export interface WodSheetRow extends Row {
  /** ISO date (yyyy-mm-dd). */
  date: string
  title: string
  blocks: WodSheetBlock[]
}

export type LogResultType = 'time' | 'rounds_reps' | 'load' | 'none'

export interface WorkoutLogRow extends Row {
  /** ISO date (yyyy-mm-dd). */
  performedAt: string
  title: string
  description: string
  /** Provenance when the entry came from a finished timer. */
  timerConfig: TimerConfig | null
  resultType: LogResultType
  result: { timeMs?: number; rounds?: number; reps?: number; loadKg?: number }
  rx: boolean
  notes: string | null
  /**
   * How the entry was created. 'timer' entries are auto-saved when a timer
   * finishes and pruned to a recent cap; absent/'manual' are deliberate.
   * Local-only — not sent to the sync DTO, so it needs no server column.
   */
  source?: 'manual' | 'timer'
}
