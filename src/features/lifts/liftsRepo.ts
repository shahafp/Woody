import { db } from '@/lib/db/db'
import type { LiftMaxRow, LiftRow } from '@/lib/db/types'
import { newId } from '@/lib/ids'

// Fixed ids: seeding is idempotent on one device AND unions cleanly when two
// devices that seeded independently later sync to the same account.
const SEED_LIFTS: Array<{ id: string; name: string }> = [
  { id: '5e60e5c8-0000-4000-8000-000000000001', name: 'Back Squat' },
  { id: '5e60e5c8-0000-4000-8000-000000000002', name: 'Front Squat' },
  { id: '5e60e5c8-0000-4000-8000-000000000003', name: 'Overhead Squat' },
  { id: '5e60e5c8-0000-4000-8000-000000000004', name: 'Deadlift' },
  { id: '5e60e5c8-0000-4000-8000-000000000005', name: 'Bench Press' },
  { id: '5e60e5c8-0000-4000-8000-000000000006', name: 'Shoulder Press' },
  { id: '5e60e5c8-0000-4000-8000-000000000007', name: 'Push Press' },
  { id: '5e60e5c8-0000-4000-8000-000000000008', name: 'Clean' },
  { id: '5e60e5c8-0000-4000-8000-000000000009', name: 'Clean & Jerk' },
  { id: '5e60e5c8-0000-4000-8000-00000000000a', name: 'Snatch' },
]

function stamp() {
  return new Date().toISOString()
}

export async function seedLiftsIfEmpty(): Promise<void> {
  // Transaction makes check+insert atomic (StrictMode mounts effects twice);
  // fixed ids make a lost race harmless anyway (bulkPut overwrites by id).
  await db.transaction('rw', db.lifts, async () => {
    const count = await db.lifts.count()
    if (count > 0) return
    const now = stamp()
    await db.lifts.bulkPut(
      SEED_LIFTS.map(({ id, name }, i) => ({
        id,
        name,
        sortOrder: i,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        dirty: 1 as const,
      })),
    )
  })
}

export async function addLift(name: string): Promise<LiftRow> {
  const now = stamp()
  const last = await db.lifts.orderBy('sortOrder').last()
  const row: LiftRow = {
    id: newId(),
    name: name.trim(),
    sortOrder: (last?.sortOrder ?? -1) + 1,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    dirty: 1,
  }
  await db.lifts.put(row)
  return row
}

export async function deleteLift(id: string): Promise<void> {
  const now = stamp()
  await db.lifts.update(id, { deletedAt: now, updatedAt: now, dirty: 1 })
  // tombstone the lift's maxes too, so they don't resurface via sync
  await db.liftMaxes
    .where('liftId')
    .equals(id)
    .modify({ deletedAt: now, updatedAt: now, dirty: 1 })
}

export async function addMax(
  liftId: string,
  valueKg: number,
  recordedAt: string,
  notes: string | null = null,
): Promise<LiftMaxRow> {
  const now = stamp()
  const row: LiftMaxRow = {
    id: newId(),
    liftId,
    valueKg,
    recordedAt,
    source: 'manual',
    notes,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    dirty: 1,
  }
  await db.liftMaxes.put(row)
  return row
}

export async function deleteMax(id: string): Promise<void> {
  await db.liftMaxes.update(id, {
    deletedAt: stamp(),
    updatedAt: stamp(),
    dirty: 1,
  })
}

/** Live rows, tombstones filtered. */
export function liveLifts(): Promise<LiftRow[]> {
  return db.lifts
    .orderBy('sortOrder')
    .filter((l) => l.deletedAt === null)
    .toArray()
}

export function liveMaxesFor(liftId: string): Promise<LiftMaxRow[]> {
  return db.liftMaxes
    .where('liftId')
    .equals(liftId)
    .filter((m) => m.deletedAt === null)
    .reverse()
    .sortBy('recordedAt')
}

/** Latest max per lift id — "current 1RM". */
export async function currentMaxes(): Promise<Map<string, LiftMaxRow>> {
  const all = await db.liftMaxes.filter((m) => m.deletedAt === null).toArray()
  const latest = new Map<string, LiftMaxRow>()
  for (const m of all) {
    const cur = latest.get(m.liftId)
    if (
      !cur ||
      m.recordedAt > cur.recordedAt ||
      (m.recordedAt === cur.recordedAt && m.createdAt > cur.createdAt)
    ) {
      latest.set(m.liftId, m)
    }
  }
  return latest
}
