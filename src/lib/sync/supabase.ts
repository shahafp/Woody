import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Null when the env isn't configured — the app is fully functional
 * offline/anonymous; auth and sync simply stay dormant.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null
