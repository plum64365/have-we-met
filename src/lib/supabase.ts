import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** False until .env.local has real values. The app shows setup help instead of crashing. */
export const isConfigured = Boolean(url && key && !url.includes('YOUR-PROJECT-REF'))

export const supabase = createClient(url || 'http://localhost:54321', key || 'not-configured', {
  // No accounts in this prototype.
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  realtime: { params: { eventsPerSecond: 20 } },
})
