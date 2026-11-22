import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase.ts'
import { useAuth } from './auth-context.ts'

/** The signed-in user's private row: phone and the must-change-password flag. */
export function useMyPrivate() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['member_private', userId],
    enabled: userId !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_private')
        .select('phone, must_change_password')
        .eq('member_id', userId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}
