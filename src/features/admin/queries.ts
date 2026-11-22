import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase.ts'

// Every admin write is a database function that checks the admin role, applies the
// business rule and writes the audit log in one transaction. These hooks only call them.

/** After any admin change, refetch everything that could show it. Cheap for 24 members. */
function useRefreshAll() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries()
}

async function rpc<T>(call: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await call
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------
export function useAllMembers() {
  return useQuery({
    queryKey: ['profiles', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, role, is_active, created_at')
        .order('is_active', { ascending: false })
        .order('display_name')
      if (error) throw error
      return data
    },
  })
}

export function useUpdateMember() {
  const refresh = useRefreshAll()
  return useMutation({
    mutationFn: (input: { id: string; displayName: string; isActive: boolean }) =>
      rpc(
        supabase.rpc('admin_update_member', {
          p_member_id: input.id,
          p_display_name: input.displayName,
          p_is_active: input.isActive,
        }),
      ),
    onSuccess: refresh,
  })
}

// ---------------------------------------------------------------------------
// Attendance for one session (every active member, with or without a record)
// ---------------------------------------------------------------------------
export function useSessionRoster(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['attendance', 'roster', sessionId],
    enabled: sessionId !== undefined,
    queryFn: async () => {
      const [members, records] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name')
          .eq('is_active', true)
          .order('display_name'),
        supabase
          .from('attendance')
          .select(
            'id, member_id, punched_in_at, status, original_status, source, manual_reason, distance_m, accuracy_m, fine:fines(id, amount_npr, status)',
          )
          .eq('session_id', sessionId!),
      ])
      if (members.error) throw members.error
      if (records.error) throw records.error
      const byMember = new Map(records.data.map((record) => [record.member_id, record]))
      // Inactive members still appear if they have a record for this session.
      const inactiveWithRecords = records.data
        .filter((record) => !members.data.some((member) => member.id === record.member_id))
        .map((record) => ({ id: record.member_id, display_name: '(inactive member)' }))
      return [...members.data, ...inactiveWithRecords].map((member) => ({
        member,
        record: byMember.get(member.id) ?? null,
      }))
    },
  })
}

export type RosterEntry = NonNullable<ReturnType<typeof useSessionRoster>['data']>[number]

export function useCorrectAttendance() {
  const refresh = useRefreshAll()
  return useMutation({
    mutationFn: (input: { attendanceId: string; status: 'on_time' | 'late'; reason: string }) =>
      rpc(
        supabase.rpc('admin_correct_attendance', {
          p_attendance_id: input.attendanceId,
          p_new_status: input.status,
          p_reason: input.reason,
        }),
      ),
    onSuccess: refresh,
  })
}

export function useRecordAttendance() {
  const refresh = useRefreshAll()
  return useMutation({
    mutationFn: (input: {
      memberId: string
      sessionId: string
      arrivedAt: string
      reason: string
    }) =>
      rpc(
        supabase.rpc('admin_record_attendance', {
          p_member_id: input.memberId,
          p_session_id: input.sessionId,
          p_arrived_at: input.arrivedAt,
          p_reason: input.reason,
        }),
      ),
    onSuccess: refresh,
  })
}

// ---------------------------------------------------------------------------
// Fines and payments
// ---------------------------------------------------------------------------
export function usePendingFines() {
  return useQuery({
    queryKey: ['fines', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fines')
        .select(
          'id, member_id, amount_npr, reason, created_at, member:profiles(display_name), attendance(session:sessions(session_date))',
        )
        .eq('status', 'pending')
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export type PendingFine = NonNullable<ReturnType<typeof usePendingFines>['data']>[number]

export function useWaiveFine() {
  const refresh = useRefreshAll()
  return useMutation({
    mutationFn: (input: { fineId: string; reason: string }) =>
      rpc(supabase.rpc('admin_waive_fine', { p_fine_id: input.fineId, p_reason: input.reason })),
    onSuccess: refresh,
  })
}

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'wallet', label: 'Wallet (eSewa, Khalti…)' },
  { value: 'other', label: 'Other' },
] as const

export function useRecordPayment() {
  const refresh = useRefreshAll()
  return useMutation({
    mutationFn: (input: { memberId: string; fineIds: string[]; method: string; note: string }) =>
      rpc(
        supabase.rpc('admin_record_payment', {
          p_member_id: input.memberId,
          p_fine_ids: input.fineIds,
          p_method: input.method,
          p_note: input.note,
        }),
      ),
    onSuccess: refresh,
  })
}

export function useRecentPayments() {
  return useQuery({
    queryKey: ['payments', 'recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(
          'id, amount_npr, method, note, created_at, voided_at, void_reason, member:profiles!payments_member_id_fkey(display_name)',
        )
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return data
    },
  })
}

export function useVoidPayment() {
  const refresh = useRefreshAll()
  return useMutation({
    mutationFn: (input: { paymentId: string; reason: string }) =>
      rpc(
        supabase.rpc('admin_void_payment', {
          p_payment_id: input.paymentId,
          p_reason: input.reason,
        }),
      ),
    onSuccess: refresh,
  })
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
export function useAuditLog() {
  return useQuery({
    queryKey: ['audit_log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, action, reason, details, created_at, actor:profiles(display_name)')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data
    },
  })
}
