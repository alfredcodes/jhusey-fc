import { useMemo, useState } from 'react'
import {
  FormError,
  FormSuccess,
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
  LoadingRows,
  PageHeader,
  SearchInput,
  SelectFilter,
  StatCard,
  Td,
  Th,
  TableFrame,
} from '../../components/ui.tsx'
import { formatNpr } from '../../lib/format.ts'
import { downloadCsv, toCsv } from '../../lib/csv.ts'
import { errorMessage } from '../../lib/errors.ts'
import { formatNepalDate, formatNepalTime } from '../../lib/nepal-time.ts'
import { methodLabel, PAYMENT_METHODS, usePaymentNotes, useVoidPayment } from '../admin/queries.ts'
import RecordPaymentModal from '../fines/RecordPaymentModal.tsx'
import {
  currentMonth,
  monthLabel,
  monthRange,
  useIsAdmin,
  usePendingFines,
  useTeamPayments,
  type TeamPayment,
} from '../team/queries.ts'

/** Payments of fines (no membership fees). Everyone sees amounts; only the admin records or voids. */
export default function PaymentsPage() {
  const isAdmin = useIsAdmin()
  const [month, setMonth] = useState(currentMonth())
  const [search, setSearch] = useState('')
  const [method, setMethod] = useState('all')
  const [recording, setRecording] = useState(false)
  const [voiding, setVoiding] = useState<TeamPayment | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const payments = useTeamPayments(monthRange(month))
  const notes = usePaymentNotes(isAdmin)
  const pending = usePendingFines()
  const voidPayment = useVoidPayment()

  const all = useMemo(() => payments.data ?? [], [payments.data])
  const rows = useMemo(
    () =>
      all.filter(
        (p) =>
          p.display_name.toLowerCase().includes(search.trim().toLowerCase()) &&
          (method === 'all' || p.method === method),
      ),
    [all, search, method],
  )
  const live = all.filter((p) => !p.voided)
  const collected = live.reduce((sum, p) => sum + p.amount_npr, 0)
  const finesSettled = live.reduce((sum, p) => sum + p.fines_count, 0)
  const outstanding = (pending.data ?? []).reduce((sum, f) => sum + f.amount_npr, 0)
  const owing = new Set((pending.data ?? []).map((f) => f.member_id)).size

  function exportCsv() {
    downloadCsv(
      `jhusey-fc-payments-${month}.csv`,
      toCsv(rows, [
        { header: 'Member', value: (r) => r.display_name },
        {
          header: 'Recorded (Nepal)',
          value: (r) =>
            `${formatNepalDate(new Date(r.created_at))} ${formatNepalTime(new Date(r.created_at))}`,
        },
        { header: 'Amount (NPR)', value: (r) => r.amount_npr },
        { header: 'Method', value: (r) => methodLabel(r.method) },
        { header: 'Fines covered', value: (r) => r.fines_count },
        { header: 'Status', value: (r) => (r.voided ? 'voided' : 'recorded') },
      ]),
    )
  }

  return (
    <>
      <PageHeader
        title="Payments"
        badges={<Badge tone="blue">{monthLabel(month)}</Badge>}
        description="Fine payments recorded by the admin. Everyone can see who has paid; payment notes stay with the admin."
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
                className={`${primaryButtonClass} w-auto`}
                onClick={() => setRecording(true)}
              >
                <Icon name="plus" className="h-4 w-4" /> Record payment
              </button>
            )}
          </>
        }
      />
      <FormSuccess message={message} />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard
          label="Fines collected"
          icon="checkCircle"
          tone="green"
          value={payments.data ? formatNpr(collected) : '–'}
          footer={
            <Badge tone="green">
              {live.length} payment{live.length === 1 ? '' : 's'}
            </Badge>
          }
          footerNote={monthLabel(month)}
        />
        <StatCard
          label="Fines settled"
          icon="receipt"
          tone="blue"
          value={payments.data ? finesSettled : '–'}
          unit="fines"
          footerNote="Covered by payments this month"
        />
        <StatCard
          label="Outstanding now"
          icon="warning"
          tone="amber"
          value={pending.data ? formatNpr(outstanding) : '–'}
          footer={
            <Badge tone="amber">
              {owing} member{owing === 1 ? '' : 's'}
            </Badge>
          }
          footerNote="All unpaid fines"
        />
      </div>

      <Card>
        <div className="space-y-4 border-b border-gray-100 p-5">
          <CardHeader
            title="Payments ledger"
            description="Official record of fine payments acknowledged by the admin"
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
              label="Payment method"
              value={method}
              onChange={setMethod}
              options={[{ value: 'all', label: 'All payment methods' }, ...PAYMENT_METHODS]}
            />
          </div>
        </div>
        {payments.isPending && <LoadingRows />}
        {payments.isError && (
          <div className="p-5">
            <FormError message={errorMessage(payments.error)} />
          </div>
        )}
        {payments.data && rows.length === 0 && (
          <EmptyState
            icon="card"
            title={all.length ? 'No payments match these filters' : 'No payments this month'}
          />
        )}
        {rows.length > 0 && (
          <TableFrame caption={`Payments for ${monthLabel(month)}`}>
            <thead className="border-b border-gray-100 bg-gray-50/60">
              <tr>
                <Th>Member</Th>
                <Th>Date & time</Th>
                <Th className="hidden md:table-cell">Covers</Th>
                <Th>Amount</Th>
                <Th className="hidden sm:table-cell">Payment method</Th>
                <Th>Status</Th>
                {isAdmin && <Th align="right">Actions</Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((payment) => {
                const extra = notes.data?.get(payment.payment_id)
                const at = new Date(payment.created_at)
                return (
                  <tr
                    key={payment.payment_id}
                    className={`transition-colors hover:bg-gray-50/60 ${payment.voided ? 'text-gray-400' : ''}`}
                  >
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={payment.display_name} />
                        <span className="font-semibold text-gray-900">{payment.display_name}</span>
                      </div>
                    </Td>
                    <Td>
                      <p className="whitespace-nowrap">{formatNepalDate(at)}</p>
                      <p className="text-[11px] text-gray-400">{formatNepalTime(at)}</p>
                    </Td>
                    <Td className="hidden text-gray-600 md:table-cell">
                      {payment.voided
                        ? '—'
                        : `${payment.fines_count} fine${payment.fines_count === 1 ? '' : 's'}`}
                    </Td>
                    <Td
                      className={`font-bold whitespace-nowrap ${payment.voided ? 'line-through' : 'text-gray-900'}`}
                    >
                      {formatNpr(payment.amount_npr)}
                    </Td>
                    <Td className="hidden sm:table-cell">
                      <p className="text-gray-700">{methodLabel(payment.method)}</p>
                      {isAdmin && extra?.note && (
                        <p className="text-[11px] text-gray-400">{extra.note}</p>
                      )}
                    </Td>
                    <Td>
                      {payment.voided ? (
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
                        {!payment.voided && (
                          <button
                            type="button"
                            className={smallButtonClass}
                            onClick={() => setVoiding(payment)}
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
        {all.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50/40 px-5 py-3 text-xs text-gray-500 sm:flex-row sm:justify-between">
            <span>
              <Badge tone="green">{live.length} recorded</Badge> · {monthLabel(month)} total{' '}
              <strong className="text-gray-800">{formatNpr(collected)}</strong>
            </span>
            <span>
              Outstanding fines: <strong className="text-rose-600">{formatNpr(outstanding)}</strong>
            </span>
          </div>
        )}
      </Card>

      {recording && <RecordPaymentModal onClose={() => setRecording(false)} onDone={setMessage} />}
      {voiding && (
        <ReasonPrompt
          title={`Void ${formatNpr(voiding.amount_npr)} from ${voiding.display_name}?`}
          description="The payment stays on record as voided and its fines become unpaid again."
          confirmLabel="Void payment"
          onCancel={() => setVoiding(null)}
          onConfirm={async (why) => {
            await voidPayment.mutateAsync({ paymentId: voiding.payment_id, reason: why })
            setMessage('Payment voided. Its fines are unpaid again.')
          }}
        />
      )}
    </>
  )
}
