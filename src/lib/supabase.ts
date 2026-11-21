import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types.ts'

// Only the project URL and the PUBLISHABLE key may reach the browser.
// Everything a user can do is decided by PostgreSQL grants and RLS, not by this client.
const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill it in.',
  )
}

export const supabase = createClient<Database>(url, publishableKey)
