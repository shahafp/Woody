import { create } from 'zustand'

interface UpdateState {
  needRefresh: boolean
  /** Applies the waiting service worker and reloads. */
  apply: (() => void) | null
}

export const useUpdateStore = create<UpdateState>(() => ({
  needRefresh: false,
  apply: null,
}))
