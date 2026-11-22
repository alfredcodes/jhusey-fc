import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase.ts'
import { useAuth } from '../auth/auth-context.ts'
import { attendanceKey } from '../attendance/queries.ts'
import type { FineRow, HistoryRow } from './summary.ts'

/** Shares the attendance key, so a new punch-in refreshes history and stats too. */
export function useMyHistory() {
  const { session } = useAuth()
  return useQuery({
    queryKey: [...attendanceKey, 'history', session?.user.id],
    queryFn: async (): Promise<HistoryRow[]> => {
      const { data, error } = await supabase.rpc('my_session_history')
      if (error) throw error
      return data as unknown as HistoryRow[]
    },
  })
}

/** The signed-in member's own fines (filtered explicitly, because RLS lets the admin read all). */
export function useMyFines() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: [...attendanceKey, 'fines', userId],
    enabled: userId !== undefined,
    queryFn: async (): Promise<FineRow[]> => {
      const { data, error } = await supabase
        .from('fines')
        .select('amount_npr, status')
        .eq('member_id', userId!)
      if (error) throw error
      return data
    },
  })
}
