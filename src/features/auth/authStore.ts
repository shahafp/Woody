import { create } from 'zustand'
import { syncNow } from '@/lib/sync/engine'
import { supabase } from '@/lib/sync/supabase'

export type AuthStatus = 'unconfigured' | 'loading' | 'signedOut' | 'signedIn'

interface AuthState {
  status: AuthStatus
  userId: string | null
  email: string | null
  init: () => void
  signInWithGoogle: (returnTo?: string) => Promise<string | null>
  signInWithEmail: (email: string, returnTo?: string) => Promise<string | null>
  signOut: () => Promise<void>
}

let initialized = false

export const useAuthStore = create<AuthState>((set) => ({
  status: supabase ? 'loading' : 'unconfigured',
  userId: null,
  email: null,

  init: () => {
    if (!supabase || initialized) return
    initialized = true
    void supabase.auth.getSession()
      .then(({ data: { session } }) => {
        set(
          session
            ? {
                status: 'signedIn',
                userId: session.user.id,
                email: session.user.email ?? null,
              }
            : { status: 'signedOut', userId: null, email: null },
        )
      })
      .catch(() => set({ status: 'signedOut', userId: null, email: null }))
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        set({
          status: 'signedIn',
          userId: session.user.id,
          email: session.user.email ?? null,
        })
        if (event === 'SIGNED_IN') void syncNow()
      } else {
        set({ status: 'signedOut', userId: null, email: null })
      }
    })
  },

  signInWithGoogle: async (returnTo = '/friends') => {
    if (!supabase) return 'Friends is not configured'
    const redirectTo = new URL(returnTo, window.location.origin).toString()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    return error ? error.message : null
  },

  signInWithEmail: async (email, returnTo = '/friends') => {
    if (!supabase) return 'Sync is not configured'
    const emailRedirectTo = new URL(returnTo, window.location.origin).toString()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    })
    return error ? error.message : null
  },

  signOut: async () => {
    await supabase?.auth.signOut()
  },
}))
