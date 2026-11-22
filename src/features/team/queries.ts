// Read-only team data every active member may see (team transparency), plus the
// club rules. All values come from the database; nothing here is computed for trust.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Tables } from '../../lib/database.types.ts'
import { nepalToday } from '../../lib/nepal-time.ts'
import { supabase } from '../../lib/supabase.ts'
import { useAuth } from '../auth/auth-context.ts'
import { useProfile } from '../auth/use-profile.ts'

export type ClubRules = Tables<'club_settings'>
export type Range = { from: string; to: string }

async function rows<T>(promise: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const { data, error } = await promise
  if (error) throw error
  return data ?? []
}

export function useIsAdmin() {
  return useProfile().data?.role === 'admin'
}

// ---------------------------------------------------------------------------
// Club rules
// ---------------------------------------------------------------------------
export function useClubRules() {
  return useQuery({
    queryKey: ['club_settings'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ClubRules | null> => {
      const { data, error } = await supabase.from('club_settings').select('*').maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateRules() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      clubName: string
      punchOpen: string
      cutoff: string
      punchClose: string
      lateFine: number
      absenceFine: number
      absenceFinesFrom: string
    }) => {
      const { error } = await supabase.rpc('admin_update_rules', {
        p_club_name: input.clubName,
        p_punch_open: input.punchOpen,
        p_on_time_cutoff: input.cutoff,
        p_punch_close: input.punchClose,
        p_late_fine_npr: input.lateFine,
        p_absence_fine_npr: input.absenceFine,
        p_absence_fines_from: input.absenceFinesFrom,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

/** "19:15:00" → "7:15 PM" */
export function timeLabel(time: string | undefined) {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

// ---------------------------------------------------------------------------
// Members and reports
// ---------------------------------------------------------------------------
export function useTeamMembers() {
  return useQuery({
    queryKey: ['profiles', 'team'],
    queryFn: () =>
      rows(
        supabase
          .from('profiles')
          .select('id, display_name, role, is_active, created_at')
          .order('display_name'),
      ),
  })
}

export type TeamMember = NonNullable<ReturnType<typeof useTeamMembers>['data']>[number]

export const teamReport = (range: Range) =>
  rows(supabase.rpc('team_report', { p_from: range.from, p_to: range.to }))
export type ReportRow = Awaited<ReturnType<typeof teamReport>>[number]

export function useTeamReport(range: Range) {
  return useQuery({ queryKey: ['attendance', 'report', range], queryFn: () => teamReport(range) })
}

export function useMonthlySummary(range: Range) {
  return useQuery({
    queryKey: ['attendance', 'monthly', range],
    queryFn: () =>
      rows(supabase.rpc('team_monthly_summary', { p_from: range.from, p_to: range.to })),
  })
}

export const teamPayments = (range: Range) =>
  rows(supabase.rpc('team_payments', { p_from: range.from, p_to: range.to }))
export type TeamPayment = Awaited<ReturnType<typeof teamPayments>>[number]

export function useTeamPayments(range: Range) {
  return useQuery({ queryKey: ['payments', 'team', range], queryFn: () => teamPayments(range) })
}

// ---------------------------------------------------------------------------
// Sessions and the roster of one session
// ---------------------------------------------------------------------------
/** Sessions up to today (newest first), for pickers on Attendance. */
export function usePastSessions(limit = 60) {
  return useQuery({
    queryKey: ['sessions', 'past', limit],
    queryFn: () =>
      rows(
        supabase
          .from('sessions')
          .select('id, session_date, status, venue:venues(name)')
          .lte('session_date', nepalToday())
          .order('session_date', { ascending: false })
          .limit(limit),
      ),
  })
}

export type RosterRow = Awaited<ReturnType<typeof fetchRoster>>[number]
const fetchRoster = (sessionId: string) =>
  rows(supabase.rpc('session_roster', { p_session_id: sessionId }))

export function useSessionRoster(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['attendance', 'roster', sessionId],
    enabled: sessionId !== undefined,
    queryFn: () => fetchRoster(sessionId!),
  })
}

// ---------------------------------------------------------------------------
// Fines (team-wide; RLS lets every active member read them)
// ---------------------------------------------------------------------------
export function useFines(range: Range) {
  return useQuery({
    queryKey: ['fines', 'list', range],
    queryFn: () =>
      rows(
        supabase
          .from('fines')
          .select(
            'id, member_id, reason, amount_npr, status, created_at, payment_id, member:profiles(display_name), session:sessions!inner(id, session_date)',
          )
          .gte('session.session_date', range.from)
          .lte('session.session_date', range.to)
          .order('created_at', { ascending: false }),
      ),
  })
}

export type FineListRow = NonNullable<ReturnType<typeof useFines>['data']>[number]

/** Every pending fine of the team (for payment recording and outstanding totals). */
export function usePendingFines() {
  return useQuery({
    queryKey: ['fines', 'pending'],
    queryFn: () =>
      rows(
        supabase
          .from('fines')
          .select(
            'id, member_id, reason, amount_npr, created_at, member:profiles(display_name), session:sessions(session_date)',
          )
          .eq('status', 'pending')
          .order('created_at'),
      ),
  })
}

export type PendingFine = NonNullable<ReturnType<typeof usePendingFines>['data']>[number]

// ---------------------------------------------------------------------------
// Absence notices (members, before the deadline)
// ---------------------------------------------------------------------------
export function useMyExcuses() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['excuses', 'mine', userId],
    enabled: userId !== undefined,
    queryFn: () =>
      rows(
        supabase
          .from('absence_excuses')
          .select('id, session_id, source, created_at')
          .eq('member_id', userId!),
      ),
  })
}

export function useNotifyAbsence() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { sessionId: string; note: string; withdraw?: boolean }) => {
      const { error } = input.withdraw
        ? await supabase.rpc('withdraw_absence', { p_session_id: input.sessionId })
        : await supabase.rpc('notify_absence', {
            p_session_id: input.sessionId,
            p_note: input.note,
          })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export function useExcuseAbsence() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { memberId: string; sessionId: string; reason: string }) => {
      const { error } = await supabase.rpc('admin_excuse_absence', {
        p_member_id: input.memberId,
        p_session_id: input.sessionId,
        p_reason: input.reason,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

// ---------------------------------------------------------------------------
// Date helpers for filters
// ---------------------------------------------------------------------------
export function monthRange(month: string): Range {
  // month = "YYYY-MM"
  const [year, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

export function currentMonth() {
  return nepalToday().slice(0, 7)
}

export function monthLabel(month: string) {
  const [year, m] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, m - 1, 1)))
}
