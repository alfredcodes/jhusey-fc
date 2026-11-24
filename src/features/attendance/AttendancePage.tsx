import { useMemo, useState, type ReactNode } from 'react'
import {
  FormError,
  inputClass,
  labelClass,
  linkButtonClass,
  dangerLinkButtonClass,
} from '../../components/form.tsx'
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
  type Tone,
} from '../../components/ui.tsx'
import { formatNpr } from '../../lib/format.ts'
import { errorMessage } from '../../lib/errors.ts'
import { formatCalendarDate, formatNepalTime, nepalToday } from '../../lib/nepal-time.ts'
import { useProfile } from '../auth/use-profile.ts'
import { useCorrectAttendance, useRecordAttendance } from '../admin/queries.ts'
import {
  currentMonth,
  monthRange,
  timeLabel,
  useClubRules,
  useExcuseAbsence,
  useIsAdmin,
  usePastSessions,
  useSessionRoster,
  useTeamReport,
  type RosterRow,
} from '../team/queries.ts'
import { FineBadge, ResultBadge } from './ResultBadge.tsx'

const STATUS_FILTERS = [
  { value: 'all', label: 'All attendance statuses' },
  { value: 'on_time', label: 'On time' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'excused', label: 'Excused' },
  { value: 'open', label: 'Not punched in yet' },
]

/** Minutes after the cutoff, for "+12 min" labels (display only). */
function minutesLate(punchedInAt: string, sessionDate: string, cutoff: string | undefined) {
  if (!cutoff) return null
  const deadline = new Date(`${sessionDate}T${cutoff}+05:45`).getTime()
  const late = Math.ceil((new Date(punchedInAt).getTime() - deadline) / 60_000)
  return late > 0 ? late : null
}

export default function AttendancePage() {
  const isAdmin = useIsAdmin()
  const sessions = usePastSessions()
  const [chosen, setChosen] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const session = sessions.data?.find((s) => s.id === chosen) ?? sessions.data?.[0]
  const roster = useSessionRoster(session?.id)
  const { data: rules } = useClubRules()

  const rows = useMemo(
    () =>
      (roster.data ?? []).filter(
        (row) =>
          row.display_name.toLowerCase().includes(search.trim().toLowerCase()) &&
          (status === 'all' || row.result === status),
      ),
    [roster.data, search, status],
  )
  const count = (result: string) => roster.data?.filter((row) => row.result === result).length ?? 0

  return (
    <>
      <PageHeader
        title="Attendance Record"
        badges={session && <Badge tone="blue">{formatCalendarDate(session.session_date)}</Badge>}
        description={
          isAdmin
            ? 'Corrections change only the current status. The original punch-in time, GPS and result are kept, and every change is saved in the audit log.'
            : 'Everyone’s result for each session. Exact locations stay private to each member and the admin.'
        }
      />

      <MonthHighlights />

      <Card>
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <SearchInput
            label="Search members"
            value={search}
            onChange={setSearch}
            placeholder="Search player by name…"
          />
          <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
            {sessions.data && session && (
              <label className="block">
                <span className="sr-only">Session</span>
                <select
                  value={session.id}
                  onChange={(event) => setChosen(event.target.value)}
                  className="block w-full rounded-xl border border-gray-200 bg-white py-2 pr-8 pl-3 text-sm text-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                >
                  {sessions.data.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatCalendarDate(s.session_date)}
                      {s.status === 'cancelled' ? ' (cancelled)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <SelectFilter
              label="Status"
              value={status}
              onChange={setStatus}
              options={STATUS_FILTERS}
            />
          </div>
        </div>

        {(sessions.isPending || roster.isPending) && sessions.data?.length !== 0 && <LoadingRows />}
        {sessions.isError && (
          <div className="p-5">
            <FormError message={errorMessage(sessions.error)} />
          </div>
        )}
        {roster.isError && (
          <div className="p-5">
            <FormError message={errorMessage(roster.error)} />
          </div>
        )}
        {sessions.data?.length === 0 && (
          <EmptyState icon="calendar" title="No sessions yet">
            Attendance appears here from the first session day.
          </EmptyState>
        )}
        {roster.data && session && rows.length === 0 && (
          <EmptyState icon="search" title="Nobody matches these filters" />
        )}
        {roster.data && session && rows.length > 0 && (
          <TableFrame caption={`Attendance for ${formatCalendarDate(session.session_date)}`}>
            <thead className="border-b border-gray-100 bg-gray-50/60">
              <tr>
                <Th>Member</Th>
                <Th>Punch-in status</Th>
                <Th className="hidden md:table-cell">Check-in</Th>
                <Th className="hidden sm:table-cell">Dues / fine</Th>
                {isAdmin && <Th align="right">Actions</Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => (
                <RosterLine
                  key={row.member_id}
                  row={row}
                  sessionId={session.id}
                  sessionDate={session.session_date}
                  cancelled={session.status === 'cancelled'}
                  cutoff={rules?.on_time_cutoff}
                  isAdmin={isAdmin}
                />
              ))}
            </tbody>
          </TableFrame>
        )}
        {roster.data && roster.data.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50/40 px-5 py-3 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {rows.length} of {roster.data.length} squad members
            </span>
            <span className="flex flex-wrap gap-x-3 gap-y-1 font-semibold">
              <span className="text-emerald-600">{count('on_time')} on time</span>
              <span className="text-amber-600">{count('late')} late</span>
              <span className="text-rose-600">{count('absent')} absent</span>
              <span className="text-gray-500">{count('excused')} excused</span>
            </span>
          </div>
        )}
      </Card>
      {rules && (
        <p className="text-xs text-gray-400">
          On time up to {timeLabel(rules.on_time_cutoff)} (whole seconds, server time). Late adds{' '}
          {formatNpr(rules.late_fine_npr)}; an absence without notice adds{' '}
          {formatNpr(rules.absence_fine_npr)} after punch-in closes at{' '}
          {timeLabel(rules.punch_close)}.
        </p>
      )}
    </>
  )
}

function MonthHighlights() {
  const today = nepalToday()
  const range = monthRange(currentMonth())
  const report = useTeamReport({ from: range.from, to: today < range.to ? today : range.to })
  const rows = (report.data ?? []).filter((row) => row.sessions > 0)
  if (rows.length === 0) return null

  const best = [...rows].sort(
    (a, b) => (b.attendance_percent ?? 0) - (a.attendance_percent ?? 0) || b.on_time - a.on_time,
  )[0]
  const worst = [...rows].sort((a, b) => b.absent - a.absent || a.on_time - b.on_time)[0]

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <HighlightCard
        label="Highest present this month"
        name={best.display_name}
        badge={<Badge tone="green">{best.attendance_percent}% present</Badge>}
        detail={`${best.on_time + best.late} of ${best.sessions} sessions attended`}
      />
      {worst.absent > 0 && (
        <HighlightCard
          label="Highest absent this month"
          name={worst.display_name}
          badge={
            <Badge tone="red">
              {worst.absent} absence{worst.absent === 1 ? '' : 's'}
            </Badge>
          }
          detail={
            worst.absence_fines_npr > 0
              ? `${formatNpr(worst.absence_fines_npr)} absence fines`
              : `${worst.excused} excused`
          }
          detailTone="text-amber-600"
        />
      )}
    </div>
  )
}

function HighlightCard({
  label,
  name,
  badge,
  detail,
  detailTone = 'text-gray-500',
}: {
  label: string
  name: string
  badge: ReactNode
  detail: string
  detailTone?: string
}) {
  return (
    <Card className="flex items-center justify-between gap-4 p-5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{label}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="truncate text-xl font-bold text-gray-900">{name}</span>
          {badge}
        </div>
        <p className={`mt-1 text-xs ${detailTone}`}>{detail}</p>
      </div>
      <Avatar name={name} size="lg" />
    </Card>
  )
}

const checkIn = (row: RosterRow): { label: string; tone: Tone } | null => {
  if (!row.attendance_id) return null
  if (row.source === 'admin') return { label: 'Recorded by admin', tone: 'purple' }
  return { label: 'Inside location', tone: 'green' }
}

function RosterLine({
  row,
  sessionId,
  sessionDate,
  cancelled,
  cutoff,
  isAdmin,
}: {
  row: RosterRow
  sessionId: string
  sessionDate: string
  cancelled: boolean
  cutoff: string | undefined
  isAdmin: boolean
}) {
  const { data: me } = useProfile()
  const correct = useCorrectAttendance()
  const record = useRecordAttendance()
  const excuse = useExcuseAbsence()
  const [open, setOpen] = useState<'correct' | 'record' | 'excuse' | null>(null)
  const [arrivedAt, setArrivedAt] = useState('19:00')
  const late = row.punched_in_at ? minutesLate(row.punched_in_at, sessionDate, cutoff) : null
  const check = checkIn(row)
  const corrected = row.original_status && row.attendance_id && row.original_status !== row.result
  const isPastOrToday = sessionDate <= nepalToday()

  return (
    <tr className="transition-colors hover:bg-gray-50/60">
      <Td>
        <div className="flex items-center gap-3">
          <Avatar name={row.display_name} />
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">
              {row.display_name}
              {row.member_id === me?.id && (
                <span className="ml-1.5 text-[11px] font-medium text-blue-600">You</span>
              )}
            </p>
            {!row.is_active && <p className="text-[11px] text-gray-400">Inactive</p>}
            <div className="mt-1 sm:hidden">
              <FineBadge
                reason={row.fine_reason}
                amount={row.fine_amount_npr}
                status={row.fine_status}
              />
            </div>
          </div>
        </div>
      </Td>
      <Td>
        {row.punched_in_at ? (
          <ResultBadge result={row.result}>
            {`${formatNepalTime(new Date(row.punched_in_at)).replace(/:\d\d (AM|PM)$/, ' $1')}${late ? ` (+${late} min)` : ''}`}
          </ResultBadge>
        ) : (
          <ResultBadge result={row.result} />
        )}
        {corrected && (
          <p className="mt-1 text-[11px] text-gray-400">
            Corrected (was {row.original_status === 'late' ? 'Late' : 'On time'})
          </p>
        )}
        {row.excuse_note && (
          <p className="mt-1 max-w-48 truncate text-[11px] text-gray-400" title={row.excuse_note}>
            “{row.excuse_note}”
          </p>
        )}
      </Td>
      <Td label="Check-in" className="hidden md:table-cell">
        {check ? (
          <div>
            <Badge tone={check.tone} dot>
              {check.label}
            </Badge>
            {row.distance_m !== null && row.accuracy_m !== null && (
              <p className="mt-1 text-[11px] text-gray-400">
                {Math.round(row.distance_m)} m away · ±{Math.round(row.accuracy_m)} m
              </p>
            )}
          </div>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </Td>
      <Td label="Dues / fine" className="hidden sm:table-cell">
        <FineBadge reason={row.fine_reason} amount={row.fine_amount_npr} status={row.fine_status} />
      </Td>
      {isAdmin && (
        <Td align="right">
          <div className="flex flex-wrap justify-end gap-1">
            {row.attendance_id && (
              <button
                type="button"
                className={dangerLinkButtonClass}
                onClick={() => setOpen('correct')}
              >
                Override
              </button>
            )}
            {!row.attendance_id && !cancelled && isPastOrToday && (
              <button type="button" className={linkButtonClass} onClick={() => setOpen('record')}>
                Record
              </button>
            )}
            {!row.attendance_id && row.result !== 'excused' && (
              <button type="button" className={linkButtonClass} onClick={() => setOpen('excuse')}>
                Excuse
              </button>
            )}
          </div>
        </Td>
      )}

      {open === 'correct' && row.attendance_id && (
        <ReasonPrompt
          title={`Change ${row.display_name} to ${row.result === 'late' ? 'On time' : 'Late'}`}
          description={
            row.result === 'late'
              ? 'The pending late fine will be waived. The original evidence is kept.'
              : 'A late fine will be added. The original evidence is kept.'
          }
          confirmLabel="Save correction"
          onCancel={() => setOpen(null)}
          onConfirm={(reason) =>
            correct.mutateAsync({
              attendanceId: row.attendance_id!,
              status: row.result === 'late' ? 'on_time' : 'late',
              reason,
            })
          }
        />
      )}
      {open === 'record' && (
        <ReasonPrompt
          title={`Record attendance for ${row.display_name}`}
          description="For a member who was there but could not punch in (no GPS). A pending absence fine is waived."
          confirmLabel="Record attendance"
          onCancel={() => setOpen(null)}
          onConfirm={(reason) =>
            record.mutateAsync({ memberId: row.member_id, sessionId, arrivedAt, reason })
          }
        >
          <label className={labelClass}>
            Arrival time (Nepal)
            <input
              type="time"
              required
              value={arrivedAt}
              onChange={(event) => setArrivedAt(event.target.value)}
              className={inputClass}
            />
          </label>
        </ReasonPrompt>
      )}
      {open === 'excuse' && (
        <ReasonPrompt
          title={`Excuse ${row.display_name}`}
          description="No absence fine for this session; a pending one is waived."
          confirmLabel="Excuse absence"
          onCancel={() => setOpen(null)}
          onConfirm={(reason) => excuse.mutateAsync({ memberId: row.member_id, sessionId, reason })}
        />
      )}
    </tr>
  )
}
