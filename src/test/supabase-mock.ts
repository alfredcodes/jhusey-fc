import type { Session } from '@supabase/supabase-js'
import { vi } from 'vitest'
import type { Profile } from '../features/auth/use-profile.ts'

/**
 * A minimal fake of the parts of the Supabase client the app uses.
 * Use it from a test file with:
 *
 *   const fake = vi.hoisted(() => ({ ...state }))   // see createFakeState
 *   vi.mock('../lib/supabase.ts', () => ({ supabase: buildFakeSupabase(fake) }))
 */
export type FakeState = {
  session: Session | null
  profile: Profile | null
}

export function sessionFor(userId: string): Session {
  return { user: { id: userId } } as Session
}

export function buildFakeSupabase(state: FakeState) {
  const profileQuery = {
    select: () => profileQuery,
    eq: () => profileQuery,
    single: async () =>
      state.profile
        ? { data: state.profile, error: null }
        : { data: null, error: { message: 'not found' } },
  }

  return {
    auth: {
      onAuthStateChange: vi.fn((callback: (event: string, session: Session | null) => void) => {
        callback('INITIAL_SESSION', state.session)
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(async () => ({ error: null })),
      resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
      verifyOtp: vi.fn(),
      updateUser: vi.fn(),
    },
    from: vi.fn(() => profileQuery),
  }
}
