import Dexie, { type Table } from 'dexie'
import type { TimerConfig, TimerEvent } from '@/features/timer/engine/types'
import type { LiftMaxRow, LiftRow, SettingsRow } from './types'

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
}

export class WodDb extends Dexie {
  activeSession!: Table<ActiveSessionRow, string>
  timerPresets!: Table<TimerPresetRow, string>
  settings!: Table<SettingsRow, string>
  lifts!: Table<LiftRow, string>
  liftMaxes!: Table<LiftMaxRow, string>

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
  }
}

export const db = new WodDb()
