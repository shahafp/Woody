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

/** How many auto-saved (finished-timer) entries to keep before pruning. */
export const AUTO_LOG_CAP = 15

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

/**
 * Safety net for finished timers: record the workout automatically so a stray
 * CLOSE can't lose it, then keep only the most recent {@link AUTO_LOG_CAP}.
 */
export async function addAutoLog(entry: NewLog): Promise<WorkoutLogRow> {
  const row = await addLog({ ...entry, source: 'timer' })
  await pruneAutoLogs()
  return row
}

async function pruneAutoLogs(): Promise<void> {
  const autos = await db.workoutLogs
    .filter((l) => l.deletedAt === null && l.source === 'timer')
    .toArray()
  autos.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const now = stamp()
  await Promise.all(
    autos
      .slice(AUTO_LOG_CAP)
      .map((l) => db.workoutLogs.update(l.id, { deletedAt: now, updatedAt: now, dirty: 1 })),
  )
}

export async function updateLog(
  id: string,
  patch: Partial<Omit<WorkoutLogRow, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.workoutLogs.update(id, { ...patch, updatedAt: stamp(), dirty: 1 })
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
