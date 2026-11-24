// Members submit their monthly fee payment (cash, or online with a receipt); the admin approves
// or rejects it. The database enforces every rule (own fee, balance, one pending, proof exists);
// the checks here only give quicker feedback.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserFacingError } from '../../lib/errors.ts'
import { supabase } from '../../lib/supabase.ts'
import { useAuth } from '../auth/auth-context.ts'

export const PROOF_BUCKET = 'payment-proofs'
export const MAX_PROOF_BYTES = 2 * 1024 * 1024
export const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export type SubmissionMethod = 'cash' | 'bank_transfer' | 'wallet'
export type SubmissionStatus = 'pending' | 'approved' | 'rejected'

export const SUBMISSION_METHODS: { value: SubmissionMethod; label: string; hint: string }[] = [
  { value: 'bank_transfer', label: 'Bank transfer', hint: 'Attach the transfer screenshot' },
  { value: 'wallet', label: 'Wallet (eSewa, Khalti…)', hint: 'Attach the payment screenshot' },
  { value: 'cash', label: 'Cash', hint: 'You handed the cash to the admin' },
]

const submissionColumns =
  'id, member_fee_id, member_id, amount_npr, method, proof_path, status, created_at, reviewed_at, review_note, fee:member_fees!inner(month), member:profiles!fee_submissions_member_id_fkey(display_name)'

/** The signed-in member's own submissions (RLS returns only theirs), newest first. */
export function useMySubmissions() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['fees', 'submissions', 'mine', userId],
    enabled: userId !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_submissions')
        .select(submissionColumns)
        .eq('member_id', userId!)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data
    },
  })
}

export type Submission = NonNullable<ReturnType<typeof useMySubmissions>['data']>[number]

/** Admin: every submission waiting for approval (the database refuses this to members). */
export function usePendingSubmissions(enabled: boolean) {
  return useQuery({
    queryKey: ['fees', 'submissions', 'pending'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_submissions')
        .select(submissionColumns)
        .eq('status', 'pending')
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

/** Checks a receipt before upload (the bucket enforces the same limits). */
export function proofProblem(file: File | null): string | null {
  if (!file) return 'Attach a screenshot or receipt of the payment.'
  if (!PROOF_TYPES.includes(file.type)) return 'Use a JPG, PNG or WebP image, or a PDF.'
  if (file.size > MAX_PROOF_BYTES) return 'The file is larger than 2 MB. Send a smaller screenshot.'
  return null
}

export function useSubmitFeePayment() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      feeId: string
      amount: number
      method: SubmissionMethod
      file: File | null
    }) => {
      const userId = session?.user.id
      if (!userId) throw new UserFacingError('Sign in again.')
      let proofPath: string | null = null
      if (input.method !== 'cash') {
        const problem = proofProblem(input.file)
        if (problem) throw new UserFacingError(problem)
        const file = input.file!
        const ext = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1]
        // Own folder: the storage policy only allows <user id>/...
        proofPath = `${userId}/${input.feeId}-${Date.now()}.${ext}`
        const { error } = await supabase.storage
          .from(PROOF_BUCKET)
          .upload(proofPath, file, { contentType: file.type, upsert: false })
        if (error) throw new UserFacingError('The receipt could not be uploaded. Try again.')
      }
      const { error } = await supabase.rpc('submit_fee_payment', {
        p_member_fee_id: input.feeId,
        p_amount_npr: input.amount,
        p_method: input.method,
        // The generated type says string; null (cash) is accepted by the function.
        p_proof_path: proofPath as string,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export function useReviewSubmission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; approve: boolean; note: string }) => {
      const { error } = await supabase.rpc('admin_review_fee_submission', {
        p_submission_id: input.id,
        p_approve: input.approve,
        p_note: input.note,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

/** A short-lived link to a private receipt (member: own; admin: all). */
export async function openProof(path: string) {
  const { data, error } = await supabase.storage.from(PROOF_BUCKET).createSignedUrl(path, 300)
  if (error || !data) throw new UserFacingError('The receipt could not be opened.')
  window.open(data.signedUrl, '_blank', 'noopener')
}
