import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { UserFacingError } from '../../lib/errors.ts'
import { supabase } from '../../lib/supabase.ts'

// Every admin write is a database function (or the admin-users Edge Function) that checks
// the admin role, applies the business rule and writes the audit log. These hooks only call them.

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
// Members and accounts
// ---------------------------------------------------------------------------
export function useUpdateMember() {
  const refresh = useRefreshAll()
  return useMutation({
    mutationFn: async (input: {
      id: string
      displayName: string
      isActive: boolean
      phone?: string | null
    }) => {
      await rpc(
        supabase.rpc('admin_update_member', {
          p_member_id: input.id,
          p_display_name: input.displayName,
          p_is_active: input.isActive,
        }),
      )
      if (input.phone !== undefined) {
        await rpc(
          supabase.rpc('admin_set_member_phone', {
            p_member_id: input.id,
            p_phone: input.phone ?? '',
          }),
        )
      }
    },
    onSuccess: refresh,
  })
}

/** Login emails, phones and sign-in status. Admin only (the database refuses others). */
export function useMemberAccounts(enabled: boolean) {
  return useQuery({
    queryKey: ['accounts'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_member_accounts')
      if (error) throw error
      return data ?? []
    },
  })
}

export type MemberAccount = NonNullable<ReturnType<typeof useMemberAccounts>['data']>[number]

/** Errors from the Edge Function carry a member-friendly `error` field. */
async function invokeAdminUsers(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null)
      throw new UserFacingError(payload?.error ?? 'The request failed. Try again.')
    }
    throw new UserFacingError('Could not reach the server. Check your connection and try again.')
  }
  return data as { member_id: string; email?: string }
}

export function useCreateMember() {
  const refresh = useRefreshAll()
  return useMutation({
    mutationFn: (input: {
      displayName: string
      username: string
      phone: string
      password: string
    }) =>
      invokeAdminUsers({
        action: 'create',
        display_name: input.displayName,
        username: input.username,
        phone: input.phone,
        password: input.password,
      }),
    onSuccess: refresh,
  })
}

export function useResetPassword() {
  const refresh = useRefreshAll()
  return useMutation({
    mutationFn: (input: { memberId: string; password: string }) =>
      invokeAdminUsers({
        action: 'reset_password',
        member_id: input.memberId,
        password: input.password,
      }),
    onSuccess: refresh,
  })
}

/** Deletes a member account; all history (attendance, fines, payments, fees) is kept. */
export function useDeleteMember() {
  const refresh = useRefreshAll()
  return useMutation({
    mutationFn: (input: { memberId: string; reason: string }) =>
      invokeAdminUsers({ action: 'delete', member_id: input.memberId, reason: input.reason }),
    onSuccess: refresh,
  })
}

/** A readable random password for the admin to share once (no look-alike characters). */
export function generatePassword(length = 12) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const values = crypto.getRandomValues(new Uint32Array(length))
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('')
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------
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

export function methodLabel(value: string) {
  return PAYMENT_METHODS.find((method) => method.value === value)?.label ?? value
}

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

/** Payment notes and void reasons: admin only (members get amounts via team_payments). */
export function usePaymentNotes(enabled: boolean) {
  return useQuery({
    queryKey: ['payments', 'notes'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, note, void_reason, voided_at')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return new Map(data.map((row) => [row.id, row]))
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
        .limit(200)
      if (error) throw error
      return data
    },
  })
}
