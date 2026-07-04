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
