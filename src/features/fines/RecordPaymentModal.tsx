import { useState, type FormEvent } from 'react'
import {
  FormError,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../components/form.tsx'
import { Modal } from '../../components/ui.tsx'
import { formatNpr } from '../../lib/format.ts'
import { errorMessage } from '../../lib/errors.ts'
import { formatCalendarDate } from '../../lib/nepal-time.ts'
import { PAYMENT_METHODS, useRecordPayment } from '../admin/queries.ts'
import { usePendingFines, type PendingFine } from '../team/queries.ts'

/**
 * Admin: one payment covers one or more WHOLE pending fines of one member
 * (no partial payments). The database checks every rule again.
 */
export default function RecordPaymentModal({
  initialMemberId,
  initialFineId,
  onClose,
  onDone,
}: {
  initialMemberId?: string
  initialFineId?: string
  onClose: () => void
  onDone: (message: string) => void
}) {
  const pending = usePendingFines()
  const record = useRecordPayment()
  const [memberId, setMemberId] = useState(initialMemberId ?? '')
  const [selected, setSelected] = useState<Set<string> | null>(
    initialFineId ? new Set([initialFineId]) : null,
  )
  const [error, setError] = useState<string | null>(null)

  const byMember = new Map<string, { name: string; fines: PendingFine[] }>()
  for (const fine of pending.data ?? []) {
    const group = byMember.get(fine.member_id) ?? {
      name: fine.member?.display_name ?? 'Member',
      fines: [],
    }
    group.fines.push(fine)
    byMember.set(fine.member_id, group)
  }
  const group = byMember.get(memberId)
  // Default: every pending fine of the chosen member is ticked.
  const chosenIds = selected ?? new Set(group?.fines.map((fine) => fine.id) ?? [])
  const chosen = group?.fines.filter((fine) => chosenIds.has(fine.id)) ?? []
  const amount = chosen.reduce((sum, fine) => sum + fine.amount_npr, 0)

  function toggle(id: string) {
    const next = new Set(chosenIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError(null)
    try {
      await record.mutateAsync({
        memberId,
        fineIds: chosen.map((fine) => fine.id),
        method: String(form.get('method')),
        note: String(form.get('note')),
      })
      onDone(`Payment of ${formatNpr(amount)} recorded for ${group?.name}.`)
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <Modal
      title="Record payment"
      description="Tick the fines this payment covers. Whole fines only."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className={labelClass}>
          Member
          <select
            required
            value={memberId}
            onChange={(event) => {
              setMemberId(event.target.value)
              setSelected(null)
            }}
            className={inputClass}
          >
            <option value="" disabled>
              {pending.isPending ? 'Loading…' : 'Choose a member with unpaid fines'}
            </option>
            {[...byMember.entries()].map(([id, g]) => (
              <option key={id} value={id}>
                {g.name} · {formatNpr(g.fines.reduce((s, f) => s + f.amount_npr, 0))} due
              </option>
            ))}
          </select>
        </label>

        {group && (
          <fieldset className="space-y-2">
            <legend className={labelClass}>Fines</legend>
            {group.fines.map((fine) => (
              <label
                key={fine.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={chosenIds.has(fine.id)}
                    onChange={() => toggle(fine.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  {fine.reason === 'late' ? 'Late arrival' : 'Unexcused absence'}
                  {fine.session && (
                    <span className="text-gray-400">
                      {formatCalendarDate(fine.session.session_date)}
                    </span>
                  )}
                </span>
                <span className="font-semibold">{formatNpr(fine.amount_npr)}</span>
              </label>
            ))}
          </fieldset>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Method
            <select name="method" className={inputClass} defaultValue="cash">
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Note (admin only)
            <input name="note" maxLength={200} className={inputClass} placeholder="Optional" />
          </label>
        </div>
        <FormError message={error} />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={chosen.length === 0 || record.isPending}
            className={primaryButtonClass}
          >
            {record.isPending ? 'Saving…' : `Record ${formatNpr(amount)} paid`}
          </button>
          <button type="button" className={secondaryButtonClass} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
