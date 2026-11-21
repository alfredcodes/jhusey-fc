// Checks the VITE_* settings before anything uses them, so a setup mistake
// shows a readable message instead of a blank page.

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** Returns a description of what is wrong with the environment, or null if it is fine. */
export function findEnvProblem(env: {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
}): string | null {
  const url = env.VITE_SUPABASE_URL?.trim()
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!url) return 'VITE_SUPABASE_URL is missing or empty.'
  if (!isHttpUrl(url)) {
    return 'VITE_SUPABASE_URL is not a valid web address. It must start with http:// or https://, for example http://127.0.0.1:54321'
  }
  if (!key) return 'VITE_SUPABASE_PUBLISHABLE_KEY is missing or empty.'
  if (key.startsWith('sb_secret_')) {
    return 'VITE_SUPABASE_PUBLISHABLE_KEY contains a SECRET key. Remove it immediately and use the publishable key (sb_publishable_…).'
  }
  return null
}
