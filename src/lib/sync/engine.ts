import type { Table } from 'dexie'
import { create } from 'zustand'
import { db, type TimerPresetRow } from '@/lib/db/db'
import type {
  LiftMaxRow,
  LiftRow,
  Row,
  SettingsRow,
  WodSheetRow,
  WorkoutLogRow,
} from '@/lib/db/types'
import { newId } from '@/lib/ids'
import { useSettingsStore } from '@/features/settings/settingsStore'
import { decideMerge } from './merge'
import { supabase } from './supabase'

const PAGE_SIZE = 500
const EPOCH = '1970-01-01T00:00:00Z'
const SETTINGS_ID = 'settings'

interface SyncStoreState {
  syncing: boolean
  lastSyncAt: number | null
  error: string | null
}

export const useSyncStore = create<SyncStoreState>(() => ({
  syncing: false,
  lastSyncAt: null,
  error: null,
}))

/* ---------- per-table remote <-> local mappers ---------- */

type RemoteRow = Record<string, unknown>

interface SyncTableDef<T extends Row> {
  remote: string
  local: () => Table<T, string>
  toRemote: (row: T, userId: string) => RemoteRow
  fromRemote: (r: RemoteRow) => T
}

const envelopeToRemote = (row: Row, userId: string) => ({
  id: row.id,
  user_id: userId,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
  deleted_at: row.deletedAt,
})

const envelopeFromRemote = (r: RemoteRow) => ({
  id: r.id as string,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
  deletedAt: (r.deleted_at as string | null) ?? null,
  dirty: 0 as const,
})

const liftsDef: SyncTableDef<LiftRow> = {
  remote: 'lifts',
  local: () => db.lifts,
  toRemote: (row, userId) => ({
    ...envelopeToRemote(row, userId),
    name: row.name,
    sort_order: row.sortOrder,
    is_archived: row.isArchived,
  }),
  fromRemote: (r) => ({
    ...envelopeFromRemote(r),
    name: r.name as string,
    sortOrder: r.sort_order as number,
    isArchived: r.is_archived as boolean,
  }),
}

const liftMaxesDef: SyncTableDef<LiftMaxRow> = {
  remote: 'lift_maxes',
  local: () => db.liftMaxes,
  toRemote: (row, userId) => ({
    ...envelopeToRemote(row, userId),
    lift_id: row.liftId,
    value_kg: row.valueKg,
    recorded_at: row.recordedAt,
    source: row.source,
    notes: row.notes,
  }),
  fromRemote: (r) => ({
    ...envelopeFromRemote(r),
    liftId: r.lift_id as string,
    valueKg: Number(r.value_kg),
    recordedAt: r.recorded_at as string,
    source: (r.source as 'manual' | 'log') ?? 'manual',
    notes: (r.notes as string | null) ?? null,
  }),
}

const presetsDef: SyncTableDef<TimerPresetRow & Row> = {
  remote: 'timer_presets',
  local: () => db.timerPresets as Table<TimerPresetRow & Row, string>,
  toRemote: (row, userId) => ({
    ...envelopeToRemote(row, userId),
    name: row.name,
    config: row.config,
  }),
  fromRemote: (r) => ({
    ...envelopeFromRemote(r),
    name: r.name as string,
    config: r.config as TimerPresetRow['config'],
  }),
}

const sheetsDef: SyncTableDef<WodSheetRow> = {
  remote: 'wod_sheets',
  local: () => db.wodSheets,
  toRemote: (row, userId) => ({
    ...envelopeToRemote(row, userId),
    date: row.date,
    title: row.title,
    blocks: row.blocks,
  }),
  fromRemote: (r) => ({
    ...envelopeFromRemote(r),
    date: r.date as string,
    title: (r.title as string) ?? '',
    blocks: (r.blocks as WodSheetRow['blocks']) ?? [],
  }),
}

const logsDef: SyncTableDef<WorkoutLogRow> = {
  remote: 'workout_logs',
  local: () => db.workoutLogs,
  toRemote: (row, userId) => ({
    ...envelopeToRemote(row, userId),
    performed_at: row.performedAt,
    title: row.title,
    description: row.description,
    timer_config: row.timerConfig,
    result_type: row.resultType,
    result: row.result,
    rx: row.rx,
    notes: row.notes,
  }),
  fromRemote: (r) => ({
    ...envelopeFromRemote(r),
    performedAt: r.performed_at as string,
    title: (r.title as string) ?? '',
    description: (r.description as string) ?? '',
    timerConfig: (r.timer_config as WorkoutLogRow['timerConfig']) ?? null,
    resultType: (r.result_type as WorkoutLogRow['resultType']) ?? 'none',
    result: (r.result as WorkoutLogRow['result']) ?? {},
    rx: (r.rx as boolean) ?? true,
    notes: (r.notes as string | null) ?? null,
  }),
}

// heterogeneous defs erased to the shared envelope; each def is internally consistent
const TABLES = [
  liftsDef,
  liftMaxesDef,
  presetsDef,
  sheetsDef,
  logsDef,
] as unknown as Array<SyncTableDef<Row>>

/* ---------- engine ---------- */

let running = false

async function pullTable(def: SyncTableDef<Row>): Promise<void> {
  if (!supabase) return
  const cursorKey = `cursor:${def.remote}`
  let cursor = (await db.syncState.get(cursorKey))?.value ?? EPOCH
  for (;;) {
    const { data, error } = await supabase
      .from(def.remote)
      .select('*')
      .gt('updated_at', cursor)
      .order('updated_at', { ascending: true })
      .limit(PAGE_SIZE)
    if (error) throw new Error(`${def.remote} pull: ${error.message}`)
    if (!data || data.length === 0) break
    for (const raw of data) {
      const incoming = def.fromRemote(raw as RemoteRow)
      const local = await def.local().get(incoming.id)
      if (decideMerge(local, incoming) === 'remote') {
        await def.local().put(incoming)
      }
    }
    cursor = (data[data.length - 1] as RemoteRow).updated_at as string
    await db.syncState.put({ key: cursorKey, value: cursor })
    if (data.length < PAGE_SIZE) break
  }
}

async function pushTable(def: SyncTableDef<Row>, userId: string): Promise<void> {
  if (!supabase) return
  const dirty = await def
    .local()
    .filter((r) => r.dirty === 1)
    .toArray()
  if (dirty.length === 0) return
  const { error } = await supabase
    .from(def.remote)
    .upsert(
      dirty.map((r) => def.toRemote(r, userId)),
      { onConflict: 'id' },
    )
  if (error) throw new Error(`${def.remote} push: ${error.message}`)
  for (const r of dirty) {
    const current = await def.local().get(r.id)
    // clear dirty only when the row wasn't edited again mid-push
    if (current && current.updatedAt === r.updatedAt) {
      await def.local().update(r.id, { dirty: 0 })
    }
  }
}

/** Settings is a per-user singleton: local id is fixed, remote id is per-account. */
async function syncSettings(userId: string): Promise<void> {
  if (!supabase) return
  const { data, error } = await supabase.from('user_settings').select('*').maybeSingle()
  if (error) throw new Error(`user_settings pull: ${error.message}`)

  if (data) {
    await db.syncState.put({ key: 'settingsRemoteId', value: data.id as string })
    const incoming: SettingsRow = {
      id: SETTINGS_ID,
      unit: data.unit,
      plateIncrementKg: Number(data.plate_increment_kg),
      plateIncrementLbs: Number(data.plate_increment_lbs),
      soundEnabled: data.sound_enabled,
      vibrateEnabled: data.vibrate_enabled,
      locale: 'en',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      deletedAt: null,
      dirty: 0,
    }
    const local = await db.settings.get(SETTINGS_ID)
    if (decideMerge(local, incoming) === 'remote') {
      await db.settings.put(incoming)
      useSettingsStore.setState({
        unit: incoming.unit,
        plateIncrementKg: incoming.plateIncrementKg,
        plateIncrementLbs: incoming.plateIncrementLbs,
        soundEnabled: incoming.soundEnabled,
        vibrateEnabled: incoming.vibrateEnabled,
      })
    }
  }

  const current = await db.settings.get(SETTINGS_ID)
  if (current?.dirty === 1) {
    const remoteId = (await db.syncState.get('settingsRemoteId'))?.value ?? newId()
    const { error: pushError } = await supabase.from('user_settings').upsert(
      {
        id: remoteId,
        user_id: userId,
        unit: current.unit,
        plate_increment_kg: current.plateIncrementKg,
        plate_increment_lbs: current.plateIncrementLbs,
        sound_enabled: current.soundEnabled,
        vibrate_enabled: current.vibrateEnabled,
        locale: current.locale,
        created_at: current.createdAt,
        updated_at: current.updatedAt,
        deleted_at: null,
      },
      { onConflict: 'user_id' },
    )
    if (pushError) throw new Error(`user_settings push: ${pushError.message}`)
    await db.syncState.put({ key: 'settingsRemoteId', value: remoteId })
    const after = await db.settings.get(SETTINGS_ID)
    if (after && after.updatedAt === current.updatedAt) {
      await db.settings.update(SETTINGS_ID, { dirty: 0 })
    }
  }
}

/**
 * First sign-in on this device for this account: mark everything dirty so
 * anonymous-era data gets pushed. Distinct UUIDs union cleanly server-side.
 */
async function claimLocalDataOnce(userId: string): Promise<void> {
  const key = `claimedFor:${userId}`
  if (await db.syncState.get(key)) return
  const tables = [
    db.lifts,
    db.liftMaxes,
    db.timerPresets,
    db.wodSheets,
    db.workoutLogs,
    db.settings,
  ] as unknown as Array<Table<{ dirty: 0 | 1 }, string>>
  await Promise.all(tables.map((table) => table.toCollection().modify({ dirty: 1 })))
  await db.syncState.put({ key, value: new Date().toISOString() })
}

export async function syncNow(): Promise<void> {
  if (!supabase || running || !navigator.onLine) return
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return

  running = true
  useSyncStore.setState({ syncing: true })
  try {
    const userId = session.user.id
    await claimLocalDataOnce(userId)
    await syncSettings(userId)
    for (const def of TABLES) {
      await pullTable(def)
      await pushTable(def, userId)
    }
    useSyncStore.setState({ lastSyncAt: Date.now(), error: null })
  } catch (e) {
    useSyncStore.setState({ error: e instanceof Error ? e.message : String(e) })
  } finally {
    running = false
    useSyncStore.setState({ syncing: false })
  }
}

/** Opportunistic background sync: launch, reconnect, tab return, slow tick. */
export function initSyncTriggers(): () => void {
  const kick = () => void syncNow()
  const onVisible = () => {
    if (document.visibilityState === 'visible') kick()
  }
  window.addEventListener('online', kick)
  document.addEventListener('visibilitychange', onVisible)
  const tick = window.setInterval(kick, 60_000)
  kick()
  return () => {
    window.removeEventListener('online', kick)
    document.removeEventListener('visibilitychange', onVisible)
    clearInterval(tick)
  }
}
