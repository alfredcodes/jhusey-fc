import { useState, type FormEvent } from 'react'
import {
  FormError,
  inputClass,
  labelClass,
  linkButtonClass,
  primaryAutoButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
} from '../../components/form.tsx'
import { Icon } from '../../components/icons.tsx'
import ReasonPrompt from '../../components/ReasonPrompt.tsx'
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Modal,
  type Tone,
} from '../../components/ui.tsx'
import { errorMessage } from '../../lib/errors.ts'
import { formatNpr } from '../../lib/format.ts'
import { formatNepalDate, formatNepalTime } from '../../lib/nepal-time.ts'
import { methodLabel } from '../admin/queries.ts'
import { monthLabel } from '../team/queries.ts'
import type { FeeRow } from './queries.ts'
import {
  MAX_PROOF_BYTES,
  openProof,
  proofProblem,
  PROOF_TYPES,
  SUBMISSION_METHODS,
  useMySubmissions,
  usePendingSubmissions,
  useReviewSubmission,
  useSubmitFeePayment,
  type Submission,
  type SubmissionMethod,
  type SubmissionStatus,
} from './submissions.ts'

const submissionBadge: Record<SubmissionStatus, { tone: Tone; label: string }> = {
  pending: { tone: 'amber', label: 'Pending approval' },
  approved: { tone: 'green', label: 'Approved' },
  rejected: { tone: 'red', label: 'Rejected' },
}

function ProofButton({ path }: { path: string | null }) {
  const [error, setError] = useState<string | null>(null)
  if (!path) return null
  return (
    <>
      <button
        type="button"
        className={linkButtonClass}
        onClick={() => openProof(path).catch((caught) => setError(errorMessage(caught)))}
      >
        <Icon name="search" className="h-3.5 w-3.5" /> View receipt
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </>
  )
}

/** The signed-in member's fee for the month: balance, submissions and "Submit payment". */
export function MyFeeCard({ month, fee }: { month: string; fee: FeeRow }) {
  const mine = useMySubmissions()
  const [submitting, setSubmitting] = useState(false)
  const forMonth = (mine.data ?? []).filter((s) => s.fee.month === `${month}-01`)
  const pending = forMonth.find((s) => s.status === 'pending')
  const canSubmit = fee.status !== 'exempt' && fee.balance_npr > 0 && !pending

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader
        title={`My payment for ${monthLabel(month)}`}
        description={
          fee.status === 'exempt'
            ? `You are exempt this month${fee.exempt_reason ? `: ${fee.exempt_reason}` : '.'}`
            : `Fee ${formatNpr(fee.amount_npr)} · paid ${formatNpr(fee.paid_npr)} · balance ${formatNpr(fee.balance_npr)}`
        }
        actions={
          canSubmit && (
            <button
              type="button"
              className={primaryAutoButtonClass}
              onClick={() => setSubmitting(true)}
            >
              <Icon name="cash" className="h-4 w-4" /> Submit payment
            </button>
          )
        }
      />
      {pending && (
        <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          Your {formatNpr(pending.amount_npr)} ({methodLabel(pending.method)}) is waiting for the
          admin to approve it.
        </p>
      )}
      {forMonth.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-50">
          {forMonth.map((submission) => (
            <li
              key={submission.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2.5"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {formatNpr(submission.amount_npr)} · {methodLabel(submission.method)}
                </p>
                <p className="text-xs text-gray-400">
                  Sent {formatNepalDate(new Date(submission.created_at))}
                  {submission.status === 'rejected' && submission.review_note
                    ? ` · ${submission.review_note}`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ProofButton path={submission.proof_path} />
                <Badge tone={submissionBadge[submission.status as SubmissionStatus].tone} dot>
                  {submissionBadge[submission.status as SubmissionStatus].label}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
      {submitting && (
        <SubmitPaymentModal fee={fee} month={month} onClose={() => setSubmitting(false)} />
      )}
    </Card>
  )
}

function SubmitPaymentModal({
  fee,
  month,
  onClose,
}: {
  fee: FeeRow
  month: string
  onClose: () => void
}) {
  const submit = useSubmitFeePayment()
  const [method, setMethod] = useState<SubmissionMethod>('bank_transfer')
  const [amount, setAmount] = useState(String(fee.balance_npr))
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (method !== 'cash') {
      const problem = proofProblem(file)
      if (problem) return setError(problem)
    }
    try {
      await submit.mutateAsync({ feeId: fee.member_fee_id, amount: Number(amount), method, file })
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <Modal
      title={`Submit payment for ${monthLabel(month)}`}
      description={`Balance ${formatNpr(fee.balance_npr)}. The admin checks it before it counts as paid.`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset>
          <legend className={labelClass}>How did you pay?</legend>
          <div className="mt-2 space-y-2">
            {SUBMISSION_METHODS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5 text-sm ${
                  method === option.value ? 'border-blue-600 bg-blue-50/60' : 'border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name="method"
                  value={option.value}
                  checked={method === option.value}
                  onChange={() => setMethod(option.value)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-semibold text-gray-900">{option.label}</span>
                  <span className="text-xs text-gray-500">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className={labelClass}>
          Amount (NPR)
          <input
            type="number"
            required
            min={1}
            max={fee.balance_npr}
            step={1}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className={inputClass}
          />
        </label>
        {method !== 'cash' && (
          <label className={labelClass}>
            Screenshot or receipt (JPG, PNG, WebP or PDF, max {MAX_PROOF_BYTES / 1024 / 1024} MB)
            <input
              type="file"
              accept={PROOF_TYPES.join(',')}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-blue-700`}
            />
            <span className="mt-1 block text-xs font-normal text-gray-400">
              Only you and the admin can see it.
            </span>
          </label>
        )}
        <FormError message={error} />
        <div className="flex gap-2">
          <button type="submit" disabled={submit.isPending} className={primaryButtonClass}>
            {submit.isPending ? 'Sending…' : `Submit ${formatNpr(Number(amount) || 0)}`}
          </button>
          <button type="button" className={secondaryButtonClass} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Admin: every submission waiting for approval, with receipt, Approve and Reject. */
export function PendingApprovals() {
  const pending = usePendingSubmissions(true)
  const review = useReviewSubmission()
  const [rejecting, setRejecting] = useState<Submission | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rows = pending.data ?? []

  async function approve(submission: Submission) {
    setError(null)
    try {
      await review.mutateAsync({ id: submission.id, approve: true, note: '' })
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            Pending approvals
            {rows.length > 0 && <Badge tone="amber">{rows.length} in queue</Badge>}
          </span>
        }
        description="Payments members submitted. Approving records the payment; nothing counts until then."
      />
      <div className="mt-4">
        <FormError message={error} />
        {pending.data && rows.length === 0 && (
          <EmptyState icon="checkCircle" title="Nothing waiting for approval" />
        )}
        {rows.length > 0 && (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((submission) => {
              const name = submission.member?.display_name ?? 'Member'
              const at = new Date(submission.created_at)
              return (
                <li
                  key={submission.id}
                  className={`rounded-2xl border p-4 ${submission.method === 'cash' ? 'border-amber-200 bg-amber-50/40' : 'border-gray-100'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Avatar name={name} />
                      <div>
                        <p className="font-semibold text-gray-900">{name}</p>
                        <p className="text-xs text-gray-500">
                          {monthLabel(submission.fee.month.slice(0, 7))} ·{' '}
                          {formatNpr(submission.amount_npr)}
                        </p>
                      </div>
                    </div>
                    <Badge tone={submission.method === 'cash' ? 'amber' : 'blue'}>
                      {methodLabel(submission.method)}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
                    <span>
                      Sent {formatNepalDate(at)} {formatNepalTime(at)}
                    </span>
                    {submission.proof_path ? (
                      <ProofButton path={submission.proof_path} />
                    ) : (
                      <span>Cash handover</span>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={review.isPending}
                      className={`${primaryButtonClass} bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700`}
                      onClick={() => approve(submission)}
                    >
                      <Icon name="check" className="h-4 w-4" />
                      {submission.method === 'cash' ? 'Confirm cash received' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      disabled={review.isPending}
                      className={smallButtonClass}
                      onClick={() => setRejecting(submission)}
                    >
                      Reject
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {rejecting && (
        <ReasonPrompt
          title={`Reject ${formatNpr(rejecting.amount_npr)} from ${rejecting.member?.display_name}?`}
          description="The member sees the reason and can submit again."
          confirmLabel="Reject submission"
          onCancel={() => setRejecting(null)}
          onConfirm={(why) => review.mutateAsync({ id: rejecting.id, approve: false, note: why })}
        />
      )}
    </Card>
  )
}
