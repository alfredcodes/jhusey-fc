import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Tables, TablesInsert, TablesUpdate } from '../../lib/database.types.ts'
import { nepalToday } from '../../lib/nepal-time.ts'
import { supabase } from '../../lib/supabase.ts'

export type Venue = Tables<'venues'>
export type SessionRow = Pick<Tables<'sessions'>, 'id' | 'session_date' | 'status' | 'note'> & {
  venue: Pick<Venue, 'id' | 'name'> | null
}

// Query keys in one place so mutations invalidate exactly what they change.
export const keys = {
  venues: ['venues'] as const,
  sessions: ['sessions'] as const,
}

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------
export function useVenues() {
  return useQuery({
    queryKey: keys.venues,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .order('is_active', { ascending: false })
        .order('name')
      if (error) throw error
      return data
    },
  })
}

export function useSaveVenue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (venue: TablesInsert<'venues'> & { id?: string }) => {
      const { id, ...fields } = venue
      const { error } = id
        ? await supabase
            .from('venues')
            .update(fields satisfies TablesUpdate<'venues'>)
            .eq('id', id)
        : await supabase.from('venues').insert(fields)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.venues })
      void queryClient.invalidateQueries({ queryKey: keys.sessions })
    },
  })
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------
const sessionColumns = 'id, session_date, status, note, venue:venues(id, name)'

/** Sessions from today (Nepal date) onwards, soonest first. */
export function useUpcomingSessions(limit = 60) {
  return useQuery({
    queryKey: [...keys.sessions, 'upcoming', limit],
    queryFn: async (): Promise<SessionRow[]> => {
      const { data, error } = await supabase
        .from('sessions')
        .select(sessionColumns)
        .gte('session_date', nepalToday())
        .order('session_date')
        .limit(limit)
      if (error) throw error
      return data
    },
  })
}

export function useCreateSessions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      venueId: string
      from: string
      to: string
      weekdays: number[]
    }) => {
      const { data, error } = await supabase.rpc('admin_create_sessions', {
        p_venue_id: input.venueId,
        p_from: input.from,
        p_to: input.to,
        p_weekdays: input.weekdays,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.sessions }),
  })
}

export function useUpdateSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...fields }: TablesUpdate<'sessions'> & { id: string }) => {
      const { error } = await supabase.from('sessions').update(fields).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.sessions }),
  })
}

export function useDeleteSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sessions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.sessions }),
  })
}
