import { useMemo, useState, type ReactNode } from 'react'
import {
  FormError,
  FormSuccess,
  linkButtonClass,
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
  EmptyState,
  LoadingRows,
  PageHeader,
  SearchInput,
  SelectFilter,
  Td,
  Th,
  TableFrame,
} from '../../components/ui.tsx'
import { formatNpr } from '../../lib/format.ts'
import { downloadCsv, toCsv } from '../../lib/csv.ts'
import { errorMessage } from '../../lib/errors.ts'
import { formatCalendarDate, formatNepalDate } from '../../lib/nepal-time.ts'
import { useWaiveFine } from '../admin/queries.ts'
import { FineStatusBadge } from '../attendance/ResultBadge.tsx'
import {
  currentMonth,
  monthLabel,
  monthRange,
  timeLabel,
  useClubRules,
  useFines,
  useIsAdmin,
  type FineListRow,
} from '../team/queries.ts'
import RecordPaymentModal from './RecordPaymentModal.tsx'

export default function FinesPage() {
  const isAdmin = useIsAdmin()
  const [month, setMonth] = useState(currentMonth())
  const [search, setSearch] = useState('')
  const [reason, setReason] = useState('all')
  const [status, setStatus] = useState('all')
  const [paying, setPaying] = useState<{ memberId?: string; fineId?: string } | null>(null)
  const [waiving, setWaiving] = useState<FineListRow | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const fines = useFines(monthRange(month))
  const waive = useWaiveFine()
  const { data: rules } = useClubRules()

  const all = useMemo(() => fines.data ?? [], [fines.data])
  const rows = useMemo(
    () =>
      all.filter(
        (fine) =>
          (fine.member?.display_name ?? '').toLowerCase().includes(search.trim().toLowerCase()) &&
          (reason === 'all' || fine.reason === reason) &&
          (status === 'all' || fine.status === status),
      ),
    [all, search, reason, status],
  )
  const sum = (list: FineListRow[]) => list.reduce((total, fine) => total + fine.amount_npr, 0)
  const live = all.filter((fine) => fine.status !== 'waived')
  const late = live.filter((fine) => fine.reason === 'late')
  const absence = live.filter((fine) => fine.reason === 'absence')
  const pendingCount = all.filter((fine) => fine.status === 'pending').length

  function exportCsv() {
    downloadCsv(
      `jhusey-fc-fines-${month}.csv`,
      toCsv(rows, [
        { header: 'Member', value: (r) => r.member?.display_name ?? '' },
        { header: 'Session date', value: (r) => r.session.session_date },
        {
          header: 'Infraction',
          value: (r) => (r.reason === 'late' ? 'Late arrival' : 'Unexcused absence'),
        },
        { header: 'Amount (NPR)', value: (r) => r.amount_npr },
        { header: 'Status', value: (r) => r.status },
      ]),
    )
  }

  return (
    <>
      <PageHeader
        title="Fines & Penalties Ledger"
        badges={
          <>
            <Badge tone="blue">{monthLabel(month)}</Badge>
            {pendingCount > 0 && <Badge tone="red">{pendingCount} pending settlement</Badge>}
          </>
        }
        actions={
          <>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={exportCsv}
              disabled={rows.length === 0}
            >
              <Icon name="download" className="h-4 w-4" /> Export ledger
            </button>
            {isAdmin && (
              <button
                type="button"
                className={`${primaryButtonClass} w-auto`}
                onClick={() => setPaying({})}
              >
                <Icon name="cash" className="h-4 w-4" /> Record payment
              </button>
            )}
          </>
        }
      />
      <FormSuccess message={message} />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <SummaryCard
          tone="amber"
          icon="clock"
          label={`Late fines (${monthLabel(month)})`}
          amount={sum(late)}
          note={`${late.length} late arrival${late.length === 1 ? '' : 's'} penalised`}
          tier={rules ? `Standard ${formatNpr(rules.late_fine_npr)} tier` : undefined}
        />
        <SummaryCard
          tone="red"
          icon="userX"
          label={`Absence fines (${monthLabel(month)})`}
          amount={sum(absence)}
          note={`${absence.length} unexcused absence${absence.length === 1 ? '' : 's'}`}
          tier={rules ? `Standard ${formatNpr(rules.absence_fine_npr)} tier` : undefined}
        />
      </div>

      <Card className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <SearchInput
          label="Search members"
          value={search}
          onChange={setSearch}
          placeholder="Search player…"
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
          label="Infraction"
          value={reason}
          onChange={setReason}
          options={[
            { value: 'all', label: 'All infractions' },
            { value: 'late', label: 'Late arrival' },
            { value: 'absence', label: 'Unexcused absence' },
          ]}
        />
        <SelectFilter
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'pending', label: 'Unpaid' },
            { value: 'paid', label: 'Paid' },
            { value: 'waived', label: 'Waived' },
          ]}
        />
      </Card>

      <Card>
        {fines.isPending && <LoadingRows />}
        {fines.isError && (
          <div className="p-5">
            <FormError message={errorMessage(fines.error)} />
          </div>
        )}
        {fines.data && rows.length === 0 && (
          <EmptyState
            icon="receipt"
            title={all.length ? 'No fines match these filters' : 'No fines this month'}
          >
            {all.length === 0 &&
              'Fines appear here when someone is late or misses a session without notice.'}
          </EmptyState>
        )}
        {rows.length > 0 && (
          <TableFrame caption={`Fines for ${monthLabel(month)}`}>
            <thead className="border-b border-gray-100 bg-gray-50/60">
              <tr>
                <Th>Member</Th>
                <Th className="hidden sm:table-cell">Date & session</Th>
                <Th>Infraction</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                {isAdmin && <Th align="right">Actions</Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((fine) => (
                <tr key={fine.id} className="transition-colors hover:bg-gray-50/60">
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={fine.member?.display_name ?? '?'} />
                      <div>
                        <p className="font-semibold text-gray-900">{fine.member?.display_name}</p>
                        <p className="text-[11px] text-gray-400 sm:hidden">
                          {formatCalendarDate(fine.session.session_date)}
                        </p>
                      </div>
                    </div>
                  </Td>
                  <Td className="hidden sm:table-cell">
                    <p className="text-gray-900">{formatCalendarDate(fine.session.session_date)}</p>
                    <p className="text-[11px] text-gray-400">
                      Fined {formatNepalDate(new Date(fine.created_at))}
                    </p>
                  </Td>
                  <Td>
                    {fine.reason === 'late' ? (
                      <Badge tone="amber">
                        <Icon name="clock" className="h-3 w-3" /> Late arrival
                      </Badge>
                    ) : (
                      <Badge tone="red">
                        <Icon name="calendar" className="h-3 w-3" /> Unexcused absence
                      </Badge>
                    )}
                  </Td>
                  <Td className="font-bold whitespace-nowrap text-gray-900">
                    {formatNpr(fine.amount_npr)}
                  </Td>
                  <Td>
                    <FineStatusBadge status={fine.status} />
                  </Td>
                  {isAdmin && (
                    <Td align="right">
                      {fine.status === 'pending' ? (
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className={`${linkButtonClass} bg-blue-50`}
                            onClick={() => setPaying({ memberId: fine.member_id, fineId: fine.id })}
                          >
                            Mark paid
                          </button>
                          <button
                            type="button"
                            className={smallButtonClass}
                            onClick={() => setWaiving(fine)}
                          >
                            Waive
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
        {all.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50/40 px-5 py-3 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {rows.length} record{rows.length === 1 ? '' : 's'} shown · Jhusey FC discipline ledger
            </span>
            <span className="flex flex-wrap gap-4">
              <span>
                Total collected:{' '}
                <strong className="text-emerald-600">
                  {formatNpr(sum(all.filter((f) => f.status === 'paid')))}
                </strong>
              </span>
              <span>
                Total outstanding:{' '}
                <strong className="text-rose-600">
                  {formatNpr(sum(all.filter((f) => f.status === 'pending')))}
                </strong>
              </span>
            </span>
          </div>
        )}
      </Card>

      {rules && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <RuleCard icon="clock" tone="text-amber-500 bg-amber-50" title="Late reporting penalty">
            Punching in after {timeLabel(rules.on_time_cutoff)} adds a{' '}
            {formatNpr(rules.late_fine_npr)} fine.
          </RuleCard>
          <RuleCard icon="userX" tone="text-rose-500 bg-rose-50" title="Unexcused absence">
            Missing a session without telling the team by midnight before the session day adds{' '}
            {formatNpr(rules.absence_fine_npr)}.
          </RuleCard>
          <RuleCard icon="card" tone="text-blue-600 bg-blue-50" title="Settlement">
            Pay the admin in cash, by bank transfer or wallet. The admin records it here and it
            shows as paid for everyone.
          </RuleCard>
        </div>
      )}

      {paying && (
        <RecordPaymentModal
          initialMemberId={paying.memberId}
          initialFineId={paying.fineId}
          onClose={() => setPaying(null)}
          onDone={setMessage}
        />
      )}
      {waiving && (
        <ReasonPrompt
          title={`Waive ${formatNpr(waiving.amount_npr)} for ${waiving.member?.display_name}`}
          description="The fine stays on record as waived."
          confirmLabel="Waive fine"
          onCancel={() => setWaiving(null)}
          onConfirm={async (why) => {
            await waive.mutateAsync({ fineId: waiving.id, reason: why })
            setMessage(`Fine waived for ${waiving.member?.display_name}.`)
          }}
        />
      )}
    </>
  )
}

function SummaryCard({
  tone,
  icon,
  label,
  amount,
  note,
  tier,
}: {
  tone: 'amber' | 'red'
  icon: 'clock' | 'userX'
  label: string
  amount: number
  note: string
  tier?: string
}) {
  const colours =
    tone === 'amber'
      ? {
          text: 'text-amber-600',
          chip: 'bg-amber-50 text-amber-700',
          icon: 'bg-amber-50 text-amber-500',
        }
      : {
          text: 'text-rose-600',
          chip: 'bg-rose-50 text-rose-600',
          icon: 'bg-rose-50 text-rose-500',
        }
  return (
    <Card className="flex items-start justify-between gap-4 p-5 sm:p-6">
      <div>
        <p
          className={`flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase ${colours.text}`}
        >
          <Icon name={icon} className="h-3.5 w-3.5" /> {label}
        </p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 tabular-nums">
          {formatNpr(amount)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-0.5 font-semibold ${colours.chip}`}>{note}</span>
          {tier && <span className="text-gray-400">{tier}</span>}
        </div>
      </div>
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${colours.icon}`}
      >
        <Icon name={icon} className="h-6 w-6" />
      </span>
    </Card>
  )
}

function RuleCard({
  icon,
  tone,
  title,
  children,
}: {
  icon: 'clock' | 'userX' | 'card'
  tone: string
  title: string
  children: ReactNode
}) {
  return (
    <Card className="flex gap-3 p-5">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">{children}</p>
      </div>
    </Card>
  )
}
