import { useState, type FormEvent } from 'react'
import {
  FormError,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../components/form.tsx'
import { Modal } from '../../components/ui.tsx'
import { errorMessage } from '../../lib/errors.ts'
import { formatNpr } from '../../lib/format.ts'
import { addDays, formatCalendarDate, nepalToday } from '../../lib/nepal-time.ts'
import { PAYMENT_METHODS } from '../admin/queries.ts'
import { monthLabel, useClubRules } from '../team/queries.ts'
import { useOpenFeeMonth, useRecordFeePayment, type FeeRow } from './queries.ts'

/** Admin: open a month (or add active members missing from an opened month). */
export function OpenMonthModal({
  month,
  period,
  onClose,
  onDone,
}: {
  month: string
  period: { opened_on: string; due_days: number } | null
  onClose: () => void
  onDone: (message: string) => void
}) {
  const open = useOpenFeeMonth()
  const { data: rules } = useClubRules()
  const [openedOn, setOpenedOn] = useState(period?.opened_on ?? nepalToday())
  const [error, setError] = useState<string | null>(null)
  // An opened month keeps its own number of days; a new one uses the current setting.
  const dueDays = period?.due_days ?? rules?.fee_due_days
  const dueOn = openedOn && dueDays ? addDays(openedOn, dueDays) : null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      const created = await open.mutateAsync({ month, openedOn })
      onDone(
        period
          ? `${created} new member fee${created === 1 ? '' : 's'} added to ${monthLabel(month)}.`
          : `${monthLabel(month)} opened: ${created} member fee${created === 1 ? '' : 's'}${dueOn ? `, due ${formatCalendarDate(dueOn)}` : ''}.`,
      )
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <Modal
      title={period ? `Add new members to ${monthLabel(month)}` : `Open ${monthLabel(month)}`}
      description={
        period
          ? 'Active members without a fee this month get one at their plan’s current amount.'
          : `Every active member gets a fee at their plan’s current amount, due ${dueDays ?? '…'} days after the open date.`
      }
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className={labelClass}>
          Open date
          <input
            type="date"
            required
            disabled={period !== null}
            value={openedOn}
            onChange={(event) => setOpenedOn(event.target.value)}
            className={inputClass}
          />
        </label>
        {dueOn && (
          <p className="rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm text-gray-600">
            Due by <strong>{formatCalendarDate(dueOn)}</strong>
            {rules && (
              <>
                {' '}
                · Regular {formatNpr(rules.regular_fee_npr)} · Partial{' '}
                {formatNpr(rules.partial_fee_npr)}
              </>
            )}
          </p>
        )}
        <FormError message={error} />
        <div className="flex gap-2">
          <button type="submit" disabled={open.isPending} className={primaryButtonClass}>
            {open.isPending ? 'Saving…' : period ? 'Add members' : 'Open month'}
          </button>
          <button type="button" className={secondaryButtonClass} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Admin: record a full payment or an instalment. The database caps it at the balance. */
export function RecordFeePaymentModal({
  fee,
  month,
  onClose,
  onDone,
}: {
  fee: FeeRow
  month: string
  onClose: () => void
  onDone: (message: string) => void
}) {
  const record = useRecordFeePayment()
  const [amount, setAmount] = useState(String(fee.balance_npr))
  const [error, setError] = useState<string | null>(null)
  const today = nepalToday()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError(null)
    try {
      await record.mutateAsync({
        feeId: fee.member_fee_id,
        amount: Number(amount),
        method: String(form.get('method')),
        paidOn: String(form.get('paidOn')),
        note: String(form.get('note')),
      })
      onDone(`${formatNpr(Number(amount))} recorded for ${fee.display_name}.`)
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <Modal
      title={`Record payment · ${fee.display_name}`}
      description={`${monthLabel(month)} fee ${formatNpr(fee.amount_npr)} · paid ${formatNpr(fee.paid_npr)} · balance ${formatNpr(fee.balance_npr)}. Instalments are fine.`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
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
          <label className={labelClass}>
            Paid on
            <input
              type="date"
              name="paidOn"
              required
              max={today}
              defaultValue={today}
              className={inputClass}
            />
          </label>
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
          <button type="submit" disabled={record.isPending} className={primaryButtonClass}>
            {record.isPending ? 'Saving…' : `Record ${formatNpr(Number(amount) || 0)}`}
          </button>
          <button type="button" className={secondaryButtonClass} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
