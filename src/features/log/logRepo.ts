import { db } from '@/lib/db/db'
import type { WorkoutLogRow } from '@/lib/db/types'
import { newId } from '@/lib/ids'

function stamp() {
  return new Date().toISOString()
}

export type NewLog = Omit<
  WorkoutLogRow,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'dirty'
>

export async function addLog(entry: NewLog): Promise<WorkoutLogRow> {
  const now = stamp()
  const row: WorkoutLogRow = {
    ...entry,
    id: newId(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    dirty: 1,
  }
  await db.workoutLogs.put(row)
  return row
}

export async function deleteLog(id: string): Promise<void> {
  await db.workoutLogs.update(id, {
    deletedAt: stamp(),
    updatedAt: stamp(),
    dirty: 1,
  })
}

/** Newest first, tombstones filtered. */
export function liveLogs(): Promise<WorkoutLogRow[]> {
  return db.workoutLogs
    .orderBy('performedAt')
    .reverse()
    .filter((l) => l.deletedAt === null)
    .toArray()
}
