import { useState, type FormEvent } from 'react'
import {
  FormError,
  FormSuccess,
  inputClass,
  primaryButtonClass,
  smallButtonClass,
} from '../../components/form.tsx'
import ReasonPrompt from '../../components/ReasonPrompt.tsx'
import { errorMessage } from '../../lib/errors.ts'
import { formatCalendarDate, formatNepalDate } from '../../lib/nepal-time.ts'
import {
  PAYMENT_METHODS,
  usePendingFines,
  useRecentPayments,
  useRecordPayment,
  useVoidPayment,
  useWaiveFine,
  type PendingFine,
} from './queries.ts'

export default function AdminFinesPage() {
  const fines = usePendingFines()
  const [message, setMessage] = useState<string | null>(null)

  // Group pending fines by member: one payment always belongs to one member.
  const byMember = new Map<string, { name: string; fines: PendingFine[] }>()
  for (const fine of fines.data ?? []) {
    const group = byMember.get(fine.member_id) ?? {
      name: fine.member?.display_name ?? 'Member',
      fines: [],
    }
    group.fines.push(fine)
    byMember.set(fine.member_id, group)
  }
  const total = (fines.data ?? []).reduce((sum, fine) => sum + fine.amount_npr, 0)

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Fines and payments</h1>
      <FormSuccess message={message} />

      <div className="space-y-3">
        <h2 className="font-semibold">Unpaid fines {fines.data && `(NPR ${total})`}</h2>
        {fines.isPending && <p className="text-slate-600">Loading fines…</p>}
        {fines.isError && <FormError message={errorMessage(fines.error)} />}
        {fines.data?.length === 0 && <p className="text-slate-600">No unpaid fines.</p>}
        {[...byMember.entries()].map(([memberId, group]) => (
          <MemberFines
            key={memberId}
            memberId={memberId}
            name={group.name}
            fines={group.fines}
            onDone={setMessage}
          />
        ))}
      </div>

      <RecentPayments />
    </section>
  )
}

function fineLabel(fine: PendingFine) {
  const date = fine.attendance?.session?.session_date
  return `${fine.reason === 'late' ? 'Late' : fine.reason}${date ? `, ${formatCalendarDate(date)}` : ''}`
}

function MemberFines({
  memberId,
  name,
  fines,
  onDone,
}: {
  memberId: string
  name: string
  fines: PendingFine[]
  onDone: (message: string) => void
}) {
  const recordPayment = useRecordPayment()
  const waive = useWaiveFine()
  const [selected, setSelected] = useState<Set<string>>(() => new Set(fines.map((f) => f.id)))
  const [waiving, setWaiving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const chosen = fines.filter((fine) => selected.has(fine.id))
  const amount = chosen.reduce((sum, fine) => sum + fine.amount_npr, 0)

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handlePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError(null)
    try {
      await recordPayment.mutateAsync({
        memberId,
        fineIds: chosen.map((fine) => fine.id),
        method: String(form.get('method')),
        note: String(form.get('note')),
      })
      onDone(`Payment of NPR ${amount} recorded for ${name}.`)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="font-semibold">{name}</p>
      <ul className="mt-2 space-y-2">
        {fines.map((fine) => (
          <li key={fine.id}>
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(fine.id)}
                  onChange={() => toggle(fine.id)}
                />
                {fineLabel(fine)} · NPR {fine.amount_npr}
              </label>
              {waiving !== fine.id && (
                <button
                  type="button"
                  className={smallButtonClass}
                  onClick={() => setWaiving(fine.id)}
                >
                  Waive
                </button>
              )}
            </div>
            {waiving === fine.id && (
              <ReasonPrompt
                title={`Waive NPR ${fine.amount_npr} for ${name}`}
                confirmLabel="Waive fine"
                onCancel={() => setWaiving(null)}
                onConfirm={async (reason) => {
                  await waive.mutateAsync({ fineId: fine.id, reason })
                  onDone(`Fine waived for ${name}.`)
                }}
              />
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={handlePayment} className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <label className="text-sm font-medium">
          Method
          <select name="method" className={inputClass} defaultValue="cash">
            {PAYMENT_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Note (optional)
          <input name="note" maxLength={200} className={inputClass} />
        </label>
        <button
          type="submit"
          disabled={chosen.length === 0 || recordPayment.isPending}
          className={`${primaryButtonClass} self-end sm:w-auto`}
        >
          Record NPR {amount} paid
        </button>
      </form>
      <FormError message={error} />
    </div>
  )
}

function RecentPayments() {
  const payments = useRecentPayments()
  const voidPayment = useVoidPayment()
  const [voiding, setVoiding] = useState<string | null>(null)
  const methodLabel = (value: string) =>
    PAYMENT_METHODS.find((method) => method.value === value)?.label ?? value

  return (
    <div className="space-y-3">
      <h2 className="font-semibold">Recent payments</h2>
      {payments.isError && <FormError message={errorMessage(payments.error)} />}
      {payments.data?.length === 0 && <p className="text-slate-600">No payments yet.</p>}
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {payments.data?.map((payment) => (
          <li key={payment.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className={payment.voided_at ? 'text-slate-500 line-through' : ''}>
                <p className="font-medium">
                  {payment.member?.display_name} · NPR {payment.amount_npr}
                </p>
                <p className="text-sm text-slate-600">
                  {formatNepalDate(new Date(payment.created_at))} · {methodLabel(payment.method)}
                  {payment.note && ` · ${payment.note}`}
                </p>
              </div>
              {payment.voided_at ? (
                <p className="text-sm text-slate-600">Voided: {payment.void_reason}</p>
              ) : (
                voiding !== payment.id && (
                  <button
                    type="button"
                    className={smallButtonClass}
                    onClick={() => setVoiding(payment.id)}
                  >
                    Void
                  </button>
                )
              )}
            </div>
            {voiding === payment.id && (
              <ReasonPrompt
                title={`Void this NPR ${payment.amount_npr} payment? Its fines become unpaid again.`}
                confirmLabel="Void payment"
                onCancel={() => setVoiding(null)}
                onConfirm={async (reason) => {
                  await voidPayment.mutateAsync({ paymentId: payment.id, reason })
                  setVoiding(null)
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
