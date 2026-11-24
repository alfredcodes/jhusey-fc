import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  FormError,
  FormSuccess,
  inputClass,
  labelClass,
  linkButtonClass,
  primaryAutoButtonClass,
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
  LoadingRows,
  PageHeader,
  SearchInput,
  SelectFilter,
  StatCard,
  Td,
  Th,
  TableFrame,
  type Tone,
} from '../../components/ui.tsx'
import { downloadCsv, toCsv } from '../../lib/csv.ts'
import { errorMessage } from '../../lib/errors.ts'
import { formatNpr } from '../../lib/format.ts'
import { formatCalendarDate } from '../../lib/nepal-time.ts'
import { methodLabel } from '../admin/queries.ts'
import { currentMonth, monthLabel, useClubRules, useIsAdmin } from '../team/queries.ts'
import { useAuth } from '../auth/auth-context.ts'
import { OpenMonthModal, RecordFeePaymentModal } from './FeeModals.tsx'
import { MyFeeCard, PendingApprovals } from './Submissions.tsx'
import {
  planLabel,
  useAdjustFee,
  useChangeFeeOpenDate,
  useExemptFee,
  useFeeLedger,
  useFeePaymentNotes,
  useFeePayments,
  useFeePeriod,
  useUnexemptFee,
  useVoidFeePayment,
  type FeePayment,
  type FeeRow,
  type FeeStatus,
} from './queries.ts'

const statusBadge: Record<FeeStatus, { tone: Tone; label: string }> = {
  paid: { tone: 'green', label: 'Paid' },
  partial: { tone: 'blue', label: 'Part paid' },
  due: { tone: 'amber', label: 'Due' },
  overdue: { tone: 'red', label: 'Overdue' },
  exempt: { tone: 'gray', label: 'Exempt' },
}

type Dialog =
  | { kind: 'open' }
  | { kind: 'pay'; fee: FeeRow }
  | { kind: 'exempt'; fee: FeeRow }
  | { kind: 'unexempt'; fee: FeeRow }
  | { kind: 'adjust'; fee: FeeRow }
  | { kind: 'openDate' }
  | { kind: 'void'; payment: FeePayment }

/** Monthly membership fees. Everyone sees the ledger; only the admin records changes. */
export default function FeesPage() {
  const isAdmin = useIsAdmin()
  const { session } = useAuth()
  const [month, setMonth] = useState(currentMonth())
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [amount, setAmount] = useState('')
  const [openDate, setOpenDate] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const { data: rules } = useClubRules()
  const period = useFeePeriod(month)
  const ledger = useFeeLedger(month)
  const payments = useFeePayments(month)
  const notes = useFeePaymentNotes(month, isAdmin)
  const exempt = useExemptFee()
  const unexempt = useUnexemptFee()
  const adjust = useAdjustFee()
  const changeDate = useChangeFeeOpenDate()
  const voidPayment = useVoidFeePayment()

  const all = useMemo(() => (ledger.data ?? []) as FeeRow[], [ledger.data])
  const rows = useMemo(
    () =>
      all.filter(
        (fee) =>
          fee.display_name.toLowerCase().includes(search.trim().toLowerCase()) &&
          (status === 'all' || fee.status === status),
      ),
    [all, search, status],
  )
  const charged = all.filter((fee) => fee.status !== 'exempt')
  const collected = charged.reduce((sum, fee) => sum + fee.paid_npr, 0)
  const outstanding = charged.reduce((sum, fee) => sum + fee.balance_npr, 0)
  const settled = charged.filter((fee) => fee.status === 'paid').length
  const overdue = all.filter((fee) => fee.status === 'overdue').length
  const rate = charged.length ? Math.round((settled / charged.length) * 1000) / 10 : 0
  const opened = period.data != null
  const myFee = all.find((fee) => fee.member_id === session?.user.id)

  function exportCsv() {
    downloadCsv(
      `jhusey-fc-monthly-fees-${month}.csv`,
      toCsv(rows, [
        { header: 'Member', value: (r) => r.display_name },
        { header: 'Plan', value: (r) => planLabel(r.plan) },
        { header: 'Fee (NPR)', value: (r) => r.amount_npr },
        { header: 'Paid (NPR)', value: (r) => r.paid_npr },
        { header: 'Balance (NPR)', value: (r) => r.balance_npr },
        { header: 'Status', value: (r) => statusBadge[r.status].label },
        { header: 'Exempt reason', value: (r) => r.exempt_reason ?? '' },
        { header: 'Due on', value: (r) => r.due_on },
        { header: 'Last paid', value: (r) => r.last_paid_on ?? '' },
      ]),
    )
  }

  return (
    <>
      <PageHeader
        title="Monthly Fees"
        badges={
          <>
            <Badge tone="blue">{monthLabel(month)}</Badge>
            {overdue > 0 && <Badge tone="red">{overdue} overdue</Badge>}
          </>
        }
        description="Monthly membership fee ledger. Fines are tracked separately under Fines."
        actions={
          <>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={exportCsv}
              disabled={rows.length === 0}
            >
              <Icon name="download" className="h-4 w-4" /> Export report
            </button>
            {isAdmin && (
              <button
                type="button"
                className={primaryAutoButtonClass}
                onClick={() => setDialog({ kind: 'open' })}
              >
                <Icon name="plus" className="h-4 w-4" />
                {opened ? 'Add new members' : 'Open month'}
              </button>
            )}
          </>
        }
      />
      <FormSuccess message={message} />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <StatCard
          label="Fees collected"
          icon="checkCircle"
          tone="green"
          value={ledger.data ? formatNpr(collected) : '–'}
          footer={<Badge tone="green">{settled} settled</Badge>}
          footerNote={`${monthLabel(month)} cycle`}
        />
        <StatCard
          label="Outstanding"
          icon="warning"
          tone="amber"
          value={ledger.data ? formatNpr(outstanding) : '–'}
          footer={
            <Badge tone={overdue ? 'red' : 'amber'}>{charged.length - settled} not settled</Badge>
          }
          footerNote={period.data ? `Due ${formatCalendarDate(period.data.due_on)}` : 'Not open'}
        />
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Settlement rate
              </p>
              {rules && (
                <p className="mt-1 text-[11px] text-gray-400">
                  Regular {formatNpr(rules.regular_fee_npr)} · Partial{' '}
                  {formatNpr(rules.partial_fee_npr)}
                </p>
              )}
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Icon name="chart" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold tracking-tight text-gray-900 tabular-nums">
              {ledger.data ? `${rate}%` : '–'}
            </span>
            <span className="text-xs text-gray-400">
              {settled} of {charged.length} clear
            </span>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100"
            role="progressbar"
            aria-label="Settlement rate"
            aria-valuenow={rate}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${rate}%` }} />
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-xs text-gray-600 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2">
          <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <span>
            <strong className="text-blue-700">Clean ledger separation:</strong> late and absence
            fines are tracked in the{' '}
            <Link to="/fines" className="font-semibold text-blue-700 underline">
              Fines ledger
            </Link>
            . Fees are due within {period.data?.due_days ?? rules?.fee_due_days ?? '…'} days of the
            month opening; instalments are fine.
          </span>
        </p>
        {period.data && (
          <span className="shrink-0 rounded-xl border border-blue-100 bg-white px-3 py-1.5 font-semibold text-blue-700">
            Opened {formatCalendarDate(period.data.opened_on)} · Due{' '}
            {formatCalendarDate(period.data.due_on)}
            {isAdmin && (
              <button
                type="button"
                className={`${linkButtonClass} ml-1`}
                onClick={() => {
                  setOpenDate(period.data?.opened_on ?? '')
                  setDialog({ kind: 'openDate' })
                }}
              >
                Change
              </button>
            )}
          </span>
        )}
      </div>

      {isAdmin && <PendingApprovals />}
      {myFee && <MyFeeCard month={month} fee={myFee} />}

      <Card>
        <div className="space-y-4 border-b border-gray-100 p-5">
          <CardHeader
            title="Fee ledger"
            description="Every member's fee for the month, kept by the admin"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SearchInput
              label="Search members"
              value={search}
              onChange={setSearch}
              placeholder="Search squad player…"
            />
            <label className="block">
              <span className="sr-only">Month</span>
              <input
                type="month"
                value={month}
                onChange={(event) => event.target.value && setMonth(event.target.value)}
                className="block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
            </label>
            <SelectFilter
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'All statuses' },
                ...Object.entries(statusBadge).map(([value, s]) => ({ value, label: s.label })),
              ]}
            />
          </div>
        </div>
        {(ledger.isPending || period.isPending) && <LoadingRows />}
        {ledger.isError && (
          <div className="p-5">
            <FormError message={errorMessage(ledger.error)} />
          </div>
        )}
        {ledger.data && !period.isPending && !opened && (
          <EmptyState icon="calendar" title={`${monthLabel(month)} is not open yet`}>
            {isAdmin
              ? 'Open the month to charge every active member their plan amount.'
              : 'The admin opens each month’s fees.'}
          </EmptyState>
        )}
        {ledger.data && opened && rows.length === 0 && (
          <EmptyState icon="card" title="No fees match these filters" />
        )}
        {rows.length > 0 && (
          <TableFrame caption={`Monthly fees for ${monthLabel(month)}`}>
            <thead className="border-b border-gray-100 bg-gray-50/60">
              <tr>
                <Th>Member</Th>
                <Th>Fee</Th>
                <Th className="hidden sm:table-cell">Paid</Th>
                <Th>Balance</Th>
                <Th>Status</Th>
                <Th className="hidden md:table-cell">Last paid</Th>
                {isAdmin && <Th align="right">Actions</Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((fee) => (
                <tr key={fee.member_fee_id} className="transition-colors hover:bg-gray-50/60">
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={fee.display_name} />
                      <div>
                        <p className="font-semibold text-gray-900">{fee.display_name}</p>
                        <p className="text-[11px] text-gray-400">
                          Monthly membership ({planLabel(fee.plan)})
                        </p>
                      </div>
                    </div>
                  </Td>
                  <Td label="Fee" className="font-semibold whitespace-nowrap text-gray-900">
                    {formatNpr(fee.amount_npr)}
                  </Td>
                  <Td
                    label="Paid"
                    className="hidden whitespace-nowrap text-emerald-600 sm:table-cell"
                  >
                    {formatNpr(fee.paid_npr)}
                  </Td>
                  <Td
                    label="Balance"
                    className={`font-bold whitespace-nowrap ${fee.balance_npr > 0 ? 'text-rose-600' : 'text-gray-400'}`}
                  >
                    {formatNpr(fee.balance_npr)}
                  </Td>
                  <Td>
                    <Badge tone={statusBadge[fee.status].tone} dot>
                      {statusBadge[fee.status].label}
                    </Badge>
                    {fee.exempt_reason && (
                      <p className="mt-1 max-w-48 text-[11px] text-gray-400">{fee.exempt_reason}</p>
                    )}
                  </Td>
                  <Td
                    label="Last paid"
                    className="hidden whitespace-nowrap text-gray-500 md:table-cell"
                  >
                    {fee.last_paid_on ? formatCalendarDate(fee.last_paid_on) : '—'}
                  </Td>
                  {isAdmin && (
                    <Td align="right">
                      <div className="flex justify-end gap-1">
                        {fee.status === 'exempt' ? (
                          <button
                            type="button"
                            className={smallButtonClass}
                            onClick={() => setDialog({ kind: 'unexempt', fee })}
                          >
                            Remove exemption
                          </button>
                        ) : (
                          <>
                            {fee.balance_npr > 0 && (
                              <button
                                type="button"
                                className={`${linkButtonClass} bg-blue-50`}
                                onClick={() => setDialog({ kind: 'pay', fee })}
                              >
                                Record
                              </button>
                            )}
                            <button
                              type="button"
                              className={smallButtonClass}
                              onClick={() => {
                                setAmount(String(fee.amount_npr))
                                setDialog({ kind: 'adjust', fee })
                              }}
                            >
                              Adjust
                            </button>
                            {fee.paid_npr === 0 && (
                              <button
                                type="button"
                                className={smallButtonClass}
                                onClick={() => setDialog({ kind: 'exempt', fee })}
                              >
                                Exempt
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
        {all.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50/40 px-5 py-3 text-xs text-gray-500 sm:flex-row sm:justify-between">
            <span>
              <Badge tone="green">{settled} members settled</Badge> · {monthLabel(month)} collected{' '}
              <strong className="text-gray-800">{formatNpr(collected)}</strong>
            </span>
            <span>
              Outstanding monthly fees:{' '}
              <strong className="text-rose-600">{formatNpr(outstanding)}</strong>
            </span>
          </div>
        )}
      </Card>

      {opened && (
        <Card>
          <div className="border-b border-gray-100 p-5">
            <CardHeader
              title="Payments this month"
              description="Every fee payment and instalment recorded by the admin"
            />
          </div>
          {payments.isPending && <LoadingRows rows={2} />}
          {payments.data && payments.data.length === 0 && (
            <EmptyState icon="cash" title="No payments recorded yet" />
          )}
          {payments.data && payments.data.length > 0 && (
            <TableFrame caption={`Fee payments for ${monthLabel(month)}`}>
              <thead className="border-b border-gray-100 bg-gray-50/60">
                <tr>
                  <Th>Member</Th>
                  <Th>Paid on</Th>
                  <Th>Amount</Th>
                  <Th className="hidden sm:table-cell">Payment method</Th>
                  <Th>Status</Th>
                  {isAdmin && <Th align="right">Actions</Th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.data.map((payment) => {
                  const name = payment.fee.member?.display_name ?? 'Member'
                  const extra = notes.data?.get(payment.id)
                  const voided = payment.voided_at !== null
                  return (
                    <tr key={payment.id} className={voided ? 'text-gray-400' : ''}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={name} size="sm" />
                          <span className="font-semibold text-gray-900">{name}</span>
                        </div>
                      </Td>
                      <Td label="Paid on" className="whitespace-nowrap">
                        {formatCalendarDate(payment.paid_on)}
                      </Td>
                      <Td
                        label="Amount"
                        className={`font-bold whitespace-nowrap ${voided ? 'line-through' : 'text-gray-900'}`}
                      >
                        {formatNpr(payment.amount_npr)}
                      </Td>
                      <Td label="Method" className="hidden sm:table-cell">
                        <p className="text-gray-700">{methodLabel(payment.method)}</p>
                        {isAdmin && extra?.note && (
                          <p className="text-[11px] text-gray-400">{extra.note}</p>
                        )}
                      </Td>
                      <Td>
                        {voided ? (
                          <div>
                            <Badge tone="gray" dot>
                              Voided
                            </Badge>
                            {isAdmin && extra?.void_reason && (
                              <p className="mt-1 text-[11px] text-gray-400">{extra.void_reason}</p>
                            )}
                          </div>
                        ) : (
                          <Badge tone="green" dot>
                            Approved by admin
                          </Badge>
                        )}
                      </Td>
                      {isAdmin && (
                        <Td align="right">
                          {!voided && (
                            <button
                              type="button"
                              className={smallButtonClass}
                              onClick={() => setDialog({ kind: 'void', payment })}
                            >
                              Void
                            </button>
                          )}
                        </Td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </TableFrame>
          )}
        </Card>
      )}

      {dialog?.kind === 'open' && (
        <OpenMonthModal
          month={month}
          period={period.data ?? null}
          onClose={() => setDialog(null)}
          onDone={setMessage}
        />
      )}
      {dialog?.kind === 'pay' && (
        <RecordFeePaymentModal
          fee={dialog.fee}
          month={month}
          onClose={() => setDialog(null)}
          onDone={setMessage}
        />
      )}
      {dialog?.kind === 'exempt' && (
        <ReasonPrompt
          title={`Exempt ${dialog.fee.display_name} for ${monthLabel(month)}?`}
          description="The whole team can see the reason. You can remove the exemption later."
          confirmLabel="Exempt member"
          onCancel={() => setDialog(null)}
          onConfirm={async (why) => {
            await exempt.mutateAsync({ feeId: dialog.fee.member_fee_id, reason: why })
            setMessage(`${dialog.fee.display_name} is exempt for ${monthLabel(month)}.`)
          }}
        />
      )}
      {dialog?.kind === 'unexempt' && (
        <ReasonPrompt
          title={`Charge ${dialog.fee.display_name} again for ${monthLabel(month)}?`}
          description={`Their fee of ${formatNpr(dialog.fee.amount_npr)} becomes due again.`}
          confirmLabel="Remove exemption"
          onCancel={() => setDialog(null)}
          onConfirm={async (why) => {
            await unexempt.mutateAsync({ feeId: dialog.fee.member_fee_id, reason: why })
            setMessage(`Exemption removed for ${dialog.fee.display_name}.`)
          }}
        />
      )}
      {dialog?.kind === 'adjust' && (
        <ReasonPrompt
          title={`Adjust ${dialog.fee.display_name}'s fee`}
          description={`Only this month changes. Already paid: ${formatNpr(dialog.fee.paid_npr)}.`}
          confirmLabel="Save fee"
          onCancel={() => setDialog(null)}
          onConfirm={async (why) => {
            await adjust.mutateAsync({
              feeId: dialog.fee.member_fee_id,
              amount: Number(amount),
              reason: why,
            })
            setMessage(`Fee for ${dialog.fee.display_name} is now ${formatNpr(Number(amount))}.`)
          }}
        >
          <label className={labelClass}>
            Fee for {monthLabel(month)} (NPR)
            <input
              type="number"
              required
              min={Math.max(dialog.fee.paid_npr, 1)}
              max={100000}
              step={1}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={inputClass}
            />
          </label>
        </ReasonPrompt>
      )}
      {dialog?.kind === 'openDate' && (
        <ReasonPrompt
          title={`Change the open date for ${monthLabel(month)}`}
          description={`The due date moves with it (${period.data?.due_days ?? '…'} days after opening).`}
          confirmLabel="Save date"
          onCancel={() => setDialog(null)}
          onConfirm={async (why) => {
            await changeDate.mutateAsync({ month, openedOn: openDate, reason: why })
            setMessage(`Open date changed to ${formatCalendarDate(openDate)}.`)
          }}
        >
          <label className={labelClass}>
            Open date
            <input
              type="date"
              required
              value={openDate}
              onChange={(event) => setOpenDate(event.target.value)}
              className={inputClass}
            />
          </label>
        </ReasonPrompt>
      )}
      {dialog?.kind === 'void' && (
        <ReasonPrompt
          title={`Void ${formatNpr(dialog.payment.amount_npr)} from ${dialog.payment.fee.member?.display_name}?`}
          description="The payment stays on record as voided and the balance goes back up."
          confirmLabel="Void payment"
          onCancel={() => setDialog(null)}
          onConfirm={async (why) => {
            await voidPayment.mutateAsync({ paymentId: dialog.payment.id, reason: why })
            setMessage('Payment voided.')
          }}
        />
      )}
    </>
  )
}
