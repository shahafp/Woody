import { db, type TimerPresetRow } from '@/lib/db/db'
import { newId } from '@/lib/ids'
import type { TimerConfig } from './engine/types'

export async function savePreset(
  name: string,
  config: TimerConfig,
): Promise<TimerPresetRow> {
  const now = new Date().toISOString()
  const row: TimerPresetRow = {
    id: newId(),
    name: name.trim(),
    config,
    createdAt: now,
    updatedAt: now,
  }
  await db.timerPresets.put(row)
  return row
}

export async function deletePreset(id: string): Promise<void> {
  await db.timerPresets.delete(id)
}
