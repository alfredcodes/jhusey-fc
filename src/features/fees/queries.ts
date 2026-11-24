// Monthly membership fees. Reads are team-wide (transparency); every write is an admin
// database function that checks the role, applies the rule and writes the audit log.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '../../lib/database.types.ts'
import { addDays } from '../../lib/nepal-time.ts'
import { supabase } from '../../lib/supabase.ts'

export type FeePlan = Database['public']['Enums']['fee_plan']
export type FeeStatus = 'due' | 'partial' | 'overdue' | 'paid' | 'exempt'

export const FEE_PLANS: { value: FeePlan; label: string }[] = [
  { value: 'regular', label: 'Regular' },
  { value: 'partial', label: 'Partial' },
]

export function planLabel(plan: FeePlan) {
  return plan === 'partial' ? 'Partial' : 'Regular'
}

/** "2026-11" → "2026-11-01" (the database stores a month as its first day). */
export const monthStart = (month: string) => `${month}-01`

async function call<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise
  if (error) throw error
  return data
}

export function useFeePeriod(month: string) {
  return useQuery({
    queryKey: ['fees', 'period', month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_periods')
        .select('month, opened_on, due_days, due_on')
        .eq('month', monthStart(month))
        .maybeSingle()
      if (error) throw error
      // due_on is a generated column (open date + due_days), never null in practice.
      return data && { ...data, due_on: data.due_on ?? addDays(data.opened_on, data.due_days) }
    },
  })
}

export function useFeeLedger(month: string) {
  return useQuery({
    queryKey: ['fees', 'ledger', month],
    queryFn: async () =>
      (await call(supabase.rpc('fee_ledger', { p_month: monthStart(month) }))) ?? [],
  })
}

export type FeeRow = NonNullable<ReturnType<typeof useFeeLedger>['data']>[number] & {
  status: FeeStatus
}

/** Payments of one month. Notes and void reasons are not readable here (admin RPC below). */
export function useFeePayments(month: string) {
  return useQuery({
    queryKey: ['fees', 'payments', month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_payments')
        .select(
          'id, member_fee_id, amount_npr, method, paid_on, created_at, voided_at, fee:member_fees!inner(month, member_id, member:profiles!member_fees_member_id_fkey(display_name))',
        )
        .eq('fee.month', monthStart(month))
        .order('paid_on', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export type FeePayment = NonNullable<ReturnType<typeof useFeePayments>['data']>[number]

export function useFeePaymentNotes(month: string, enabled: boolean) {
  return useQuery({
    queryKey: ['fees', 'notes', month],
    enabled,
    queryFn: async () => {
      const data =
        (await call(supabase.rpc('admin_fee_payment_notes', { p_month: monthStart(month) }))) ?? []
      return new Map(data.map((row) => [row.payment_id, row]))
    },
  })
}

// ---------------------------------------------------------------------------
// Admin writes
// ---------------------------------------------------------------------------
function useAdminMutation<I, O>(fn: (input: I) => Promise<O>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => queryClient.invalidateQueries() })
}

export const useOpenFeeMonth = () =>
  useAdminMutation((input: { month: string; openedOn: string }) =>
    call(
      supabase.rpc('admin_open_fee_month', {
        p_month: monthStart(input.month),
        p_opened_on: input.openedOn,
      }),
    ),
  )

export const useChangeFeeOpenDate = () =>
  useAdminMutation((input: { month: string; openedOn: string; reason: string }) =>
    call(
      supabase.rpc('admin_change_fee_open_date', {
        p_month: monthStart(input.month),
        p_opened_on: input.openedOn,
        p_reason: input.reason,
      }),
    ),
  )

export const useRecordFeePayment = () =>
  useAdminMutation(
    (input: { feeId: string; amount: number; method: string; paidOn: string; note: string }) =>
      call(
        supabase.rpc('admin_record_fee_payment', {
          p_member_fee_id: input.feeId,
          p_amount_npr: input.amount,
          p_method: input.method,
          p_paid_on: input.paidOn,
          p_note: input.note,
        }),
      ),
  )

export const useVoidFeePayment = () =>
  useAdminMutation((input: { paymentId: string; reason: string }) =>
    call(
      supabase.rpc('admin_void_fee_payment', {
        p_payment_id: input.paymentId,
        p_reason: input.reason,
      }),
    ),
  )

export const useExemptFee = () =>
  useAdminMutation((input: { feeId: string; reason: string }) =>
    call(
      supabase.rpc('admin_exempt_fee', { p_member_fee_id: input.feeId, p_reason: input.reason }),
    ),
  )

export const useUnexemptFee = () =>
  useAdminMutation((input: { feeId: string; reason: string }) =>
    call(
      supabase.rpc('admin_unexempt_fee', { p_member_fee_id: input.feeId, p_reason: input.reason }),
    ),
  )

export const useAdjustFee = () =>
  useAdminMutation((input: { feeId: string; amount: number; reason: string }) =>
    call(
      supabase.rpc('admin_adjust_member_fee', {
        p_member_fee_id: input.feeId,
        p_amount_npr: input.amount,
        p_reason: input.reason,
      }),
    ),
  )

export const useSetFeePlan = () =>
  useAdminMutation((input: { memberId: string; plan: FeePlan }) =>
    call(supabase.rpc('admin_set_fee_plan', { p_member_id: input.memberId, p_plan: input.plan })),
  )

/** Fee amounts and both payment deadlines. `fineDueDays: null` means fines have no deadline. */
export const useUpdatePaymentSettings = () =>
  useAdminMutation(
    (input: { regular: number; partial: number; feeDueDays: number; fineDueDays: number | null }) =>
      call(
        supabase.rpc('admin_update_payment_settings', {
          p_regular_npr: input.regular,
          p_partial_npr: input.partial,
          p_fee_due_days: input.feeDueDays,
          // The generated type says number; null (no deadline) is accepted by the function.
          p_fine_due_days: input.fineDueDays as number,
        }),
      ),
  )
