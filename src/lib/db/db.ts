import Dexie, { type Table } from 'dexie'
import type { TimerConfig, TimerEvent } from '@/features/timer/engine/types'

export interface ActiveSessionRow {
  id: 'current'
  config: TimerConfig
  events: TimerEvent[]
  startedAt: number
}

export class WodDb extends Dexie {
  activeSession!: Table<ActiveSessionRow, string>

  constructor() {
    super('wod-time')
    this.version(1).stores({
      activeSession: 'id',
    })
  }
}

export const db = new WodDb()
