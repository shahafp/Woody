import Dexie, { type Table } from 'dexie'
import type { TimerConfig, TimerEvent } from '@/features/timer/engine/types'

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

  constructor() {
    super('wod-time')
    this.version(1).stores({
      activeSession: 'id',
    })
    this.version(2).stores({
      timerPresets: 'id, name',
    })
  }
}

export const db = new WodDb()
