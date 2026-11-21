import type { Session } from '@supabase/supabase-js'
import { vi } from 'vitest'
import type { Profile } from '../features/auth/use-profile.ts'

/**
 * A minimal fake of the parts of the Supabase client the app uses.
 * Use it from a test file with:
 *
 *   const fake = vi.hoisted((): FakeState => ({ session: null, profile: null, rows: {} }))
 *   vi.mock('../lib/supabase.ts', async () => {
 *     const { buildFakeSupabase } = await import('../test/supabase-mock.ts')
 *     return { supabase: buildFakeSupabase(fake) }
 *   })
 */
export type FakeState = {
  session: Session | null
  profile: Profile | null
  /** Rows returned by list queries, per table name. */
  rows: Record<string, unknown[]>
}

export function sessionFor(userId: string): Session {
  return { user: { id: userId } } as Session
}

/** A query builder: every filter returns itself; awaiting it yields the table's rows. */
function fakeQuery(state: FakeState, table: string) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    single: async () =>
      table === 'profiles' && state.profile
        ? { data: state.profile, error: null }
        : { data: null, error: { message: 'not found' } },
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data: state.rows[table] ?? [], error: null }).then(resolve),
  }
  return builder
}

export function buildFakeSupabase(state: FakeState) {
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
    from: vi.fn((table: string) => fakeQuery(state, table)),
    rpc: vi.fn(),
  }
}
