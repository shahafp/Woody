import { db } from '@/lib/db/db'
import type { WodSheetBlock, WodSheetRow } from '@/lib/db/types'
import { newId } from '@/lib/ids'

function stamp() {
  return new Date().toISOString()
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** The editable sheet for a date, created lazily on first write. */
export async function getSheetForDate(date: string): Promise<WodSheetRow | undefined> {
  return db.wodSheets
    .where('date')
    .equals(date)
    .filter((s) => s.deletedAt === null)
    .first()
}

async function ensureSheet(date: string): Promise<WodSheetRow> {
  return db.transaction('rw', db.wodSheets, async () => {
    const existing = await getSheetForDate(date)
    if (existing) return existing
    const now = stamp()
    const row: WodSheetRow = {
      id: newId(),
      date,
      title: '',
      blocks: [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      dirty: 1,
    }
    await db.wodSheets.put(row)
    return row
  })
}

export async function addBlock(
  date: string,
  block: Omit<WodSheetBlock, 'id'>,
): Promise<void> {
  const sheet = await ensureSheet(date)
  await db.wodSheets.update(sheet.id, {
    blocks: [...sheet.blocks, { ...block, id: newId() }],
    updatedAt: stamp(),
    dirty: 1,
  })
}

export async function removeBlock(sheetId: string, blockId: string): Promise<void> {
  const sheet = await db.wodSheets.get(sheetId)
  if (!sheet) return
  await db.wodSheets.update(sheetId, {
    blocks: sheet.blocks.filter((b) => b.id !== blockId),
    updatedAt: stamp(),
    dirty: 1,
  })
}
