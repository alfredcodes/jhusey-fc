import { useQuery } from '@tanstack/react-query'
import type { Tables } from '../../lib/database.types.ts'
import { supabase } from '../../lib/supabase.ts'
import { useAuth } from './auth-context.ts'

// Generated from the database schema by `npm run db:types`.
export type Profile = Pick<Tables<'profiles'>, 'id' | 'display_name' | 'role' | 'is_active'>
/** The signed-in user's own profile. RLS guarantees a member can only read their own row. */
export function useProfile() {
  const { session } = useAuth()
  const userId = session?.user.id

  return useQuery({
    queryKey: ['profile', userId],
    enabled: userId !== undefined,
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, role, is_active')
        .eq('id', userId!)
        .single()
      if (error) throw error
      return data
    },
  })
}
