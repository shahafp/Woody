import { create } from 'zustand'
import { db } from '@/lib/db/db'
import type { SettingsRow } from '@/lib/db/types'
import type { Unit } from '@/lib/units/convert'

const SETTINGS_ID = 'settings'

const DEFAULTS: Omit<SettingsRow, 'createdAt' | 'updatedAt'> = {
  id: SETTINGS_ID,
  unit: 'kg',
  plateIncrementKg: 2.5,
  plateIncrementLbs: 5,
  soundEnabled: true,
  vibrateEnabled: true,
  locale: 'en',
  deletedAt: null,
  dirty: 0,
}

interface SettingsState {
  unit: Unit
  plateIncrementKg: number
  plateIncrementLbs: number
  soundEnabled: boolean
  vibrateEnabled: boolean
  hydrated: boolean
  hydrate: () => Promise<void>
  update: (
    patch: Partial<
      Pick<
        SettingsState,
        | 'unit'
        | 'plateIncrementKg'
        | 'plateIncrementLbs'
        | 'soundEnabled'
        | 'vibrateEnabled'
      >
    >,
  ) => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  unit: DEFAULTS.unit,
  plateIncrementKg: DEFAULTS.plateIncrementKg,
  plateIncrementLbs: DEFAULTS.plateIncrementLbs,
  soundEnabled: DEFAULTS.soundEnabled,
  vibrateEnabled: DEFAULTS.vibrateEnabled,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return
    const row = await db.settings.get(SETTINGS_ID)
    if (row) {
      set({
        unit: row.unit,
        plateIncrementKg: row.plateIncrementKg,
        plateIncrementLbs: row.plateIncrementLbs,
        soundEnabled: row.soundEnabled,
        vibrateEnabled: row.vibrateEnabled,
        hydrated: true,
      })
    } else {
      const now = new Date().toISOString()
      await db.settings.put({ ...DEFAULTS, createdAt: now, updatedAt: now })
      set({ hydrated: true })
    }
  },

  update: (patch) => {
    set(patch)
    const s = get()
    void db.settings.update(SETTINGS_ID, {
      unit: s.unit,
      plateIncrementKg: s.plateIncrementKg,
      plateIncrementLbs: s.plateIncrementLbs,
      soundEnabled: s.soundEnabled,
      vibrateEnabled: s.vibrateEnabled,
      updatedAt: new Date().toISOString(),
      dirty: 1,
    })
  },
}))
