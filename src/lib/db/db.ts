import Dexie, { type Table } from 'dexie'
import type { TimerConfig, TimerEvent } from '@/features/timer/engine/types'
import type {
  LiftMaxRow,
  LiftRow,
  SettingsRow,
  WodSheetRow,
  WorkoutLogRow,
} from './types'

export interface ActiveSessionRow {
  id: 'current'
  config: TimerConfig
  events: TimerEvent[]
  startedAt: number
}

export interface TimerPresetRow {
  id: string
  name: string
  config: TimerConfig
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  dirty: 0 | 1
}

export interface SyncStateRow {
  key: string
  value: string
}

export class WodDb extends Dexie {
  activeSession!: Table<ActiveSessionRow, string>
  timerPresets!: Table<TimerPresetRow, string>
  settings!: Table<SettingsRow, string>
  lifts!: Table<LiftRow, string>
  liftMaxes!: Table<LiftMaxRow, string>
  wodSheets!: Table<WodSheetRow, string>
  workoutLogs!: Table<WorkoutLogRow, string>
  syncState!: Table<SyncStateRow, string>

  constructor() {
    super('wod-time')
    this.version(1).stores({
      activeSession: 'id',
    })
    this.version(2).stores({
      timerPresets: 'id, name',
    })
    this.version(3).stores({
      settings: 'id',
      lifts: 'id, sortOrder',
      liftMaxes: 'id, liftId, recordedAt',
    })
    this.version(4).stores({
      wodSheets: 'id, date',
      workoutLogs: 'id, performedAt',
    })
    this.version(5)
      .stores({
        syncState: 'key',
      })
      .upgrade((tx) =>
        // presets predate the sync envelope — backfill it
        tx
          .table('timerPresets')
          .toCollection()
          .modify((p: Record<string, unknown>) => {
            if (p.deletedAt === undefined) p.deletedAt = null
            if (p.dirty === undefined) p.dirty = 1
          }),
      )
  }
}

export const db = new WodDb()
