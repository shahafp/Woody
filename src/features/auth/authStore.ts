import { create } from 'zustand'
import { syncNow } from '@/lib/sync/engine'
import { supabase } from '@/lib/sync/supabase'

export type AuthStatus = 'unconfigured' | 'loading' | 'signedOut' | 'signedIn'

interface AuthState {
  status: AuthStatus
  email: string | null
  init: () => void
  signInWithEmail: (email: string) => Promise<string | null>
  signOut: () => Promise<void>
}

let initialized = false

export const useAuthStore = create<AuthState>((set) => ({
  status: supabase ? 'loading' : 'unconfigured',
  email: null,

  init: () => {
    if (!supabase || initialized) return
    initialized = true
    void supabase.auth.getSession().then(({ data: { session } }) => {
      set(
        session
          ? { status: 'signedIn', email: session.user.email ?? null }
          : { status: 'signedOut', email: null },
      )
    })
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        set({ status: 'signedIn', email: session.user.email ?? null })
        if (event === 'SIGNED_IN') void syncNow()
      } else {
        set({ status: 'signedOut', email: null })
      }
    })
  },

  signInWithEmail: async (email) => {
    if (!supabase) return 'Sync is not configured'
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    return error ? error.message : null
  },

  signOut: async () => {
    await supabase?.auth.signOut()
  },
}))
