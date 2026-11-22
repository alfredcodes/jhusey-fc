import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/auth-context.ts'
import { supabase } from '../../lib/supabase.ts'

export type AttendanceStatus = 'on_time' | 'late'

/** What punch_in() returns. The server decides every value. */
export type PunchInResult = {
  punched_in_at: string
  status: AttendanceStatus
  distance_m: number
  accuracy_m: number
  venue_name: string
  fine_npr: number | null
}

export const attendanceKey = ['attendance'] as const

/** The signed-in member's own punch-in for one session, or null if none yet. */
export function useMyAttendance(sessionId: string | undefined) {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: [...attendanceKey, 'mine', sessionId, userId],
    enabled: sessionId !== undefined && userId !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select(
          'id, punched_in_at, status, source, distance_m, accuracy_m, fine:fines(amount_npr, status)',
        )
        .eq('session_id', sessionId!)
        .eq('member_id', userId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function usePunchIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (position: { latitude: number; longitude: number; accuracy: number }) => {
      // Only coordinates and accuracy are sent. Time, status, distance and fine come from the server.
      const { data, error } = await supabase.rpc('punch_in', {
        p_latitude: position.latitude,
        p_longitude: position.longitude,
        p_accuracy_m: position.accuracy,
      })
      if (error) throw error
      return data as unknown as PunchInResult
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attendanceKey }),
  })
}

/** Admin: everyone's punch-ins for one session. RLS returns only the caller's own row to members. */
export function useSessionAttendance(sessionId: string | undefined) {
  return useQuery({
    queryKey: [...attendanceKey, 'session', sessionId],
    enabled: sessionId !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select(
          'id, member_id, punched_in_at, status, source, distance_m, accuracy_m, member:profiles!attendance_member_id_fkey(display_name)',
        )
        .eq('session_id', sessionId!)
        .order('punched_in_at')
      if (error) throw error
      return data
    },
  })
}

/** Admin: active members, to show who has not punched in yet. */
export function useActiveMembers() {
  return useQuery({
    queryKey: ['profiles', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('is_active', true)
        .order('display_name')
      if (error) throw error
      return data
    },
  })
}
