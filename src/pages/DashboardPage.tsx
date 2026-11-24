import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Donut } from '../components/charts.tsx'
import { chartColors } from '../components/chart-colors.ts'
import { FormError } from '../components/form.tsx'
import { Icon } from '../components/icons.tsx'
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  LoadingRows,
  Segmented,
  StatCard,
} from '../components/ui.tsx'
import { formatNpr } from '../lib/format.ts'
import { useProfile } from '../features/auth/use-profile.ts'
import NextSessionCard from '../features/sessions/NextSessionCard.tsx'
import NotComingCard from '../features/sessions/NotComingCard.tsx'
import { useUpcomingSessions } from '../features/sessions/queries.ts'
import {
  currentMonth,
  monthLabel,
  monthRange,
  usePendingFines,
  useSessionRoster,
  useTeamMembers,
  useTeamPayments,
  useTeamReport,
  type ReportRow,
} from '../features/team/queries.ts'
import { errorMessage } from '../lib/errors.ts'
import { addDays, nepalToday } from '../lib/nepal-time.ts'

export default function DashboardPage() {
  const { data: profile } = useProfile()
  const today = nepalToday()
  const sessions = useUpcomingSessions(10)
  const todaySession = sessions.data?.find(
    (session) => session.session_date === today && session.status === 'scheduled',
  )

  return (
    <>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Welcome back, {profile?.display_name}
        </h1>
        <span className="text-2xl select-none" aria-hidden="true">
          👋
        </span>
      </div>

      <TeamStats todaySessionId={todaySession?.id} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <AttendanceOverview />
        </div>
        <div className="lg:col-span-7">
          <Highlights />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <NotComingCard />
        <NextSessionCard />
      </div>
    </>
  )
}

function TeamStats({ todaySessionId }: { todaySessionId: string | undefined }) {
  const month = currentMonth()
  const members = useTeamMembers()
  const payments = useTeamPayments(monthRange(month))
  const pending = usePendingFines()
  const roster = useSessionRoster(todaySessionId)

  const active = members.data?.filter((member) => member.is_active) ?? []
  const joinedThisMonth = active.filter((member) => member.created_at.slice(0, 7) === month).length
  const live = (payments.data ?? []).filter((payment) => !payment.voided)
  const collected = live.reduce((sum, payment) => sum + payment.amount_npr, 0)
  const outstanding = (pending.data ?? []).reduce((sum, fine) => sum + fine.amount_npr, 0)
  const owing = new Set((pending.data ?? []).map((fine) => fine.member_id)).size
  const present =
    roster.data?.filter((row) => row.result === 'on_time' || row.result === 'late').length ?? 0
  const expected = roster.data?.length ?? 0

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
      <StatCard
        label="Total members"
        icon="team"
        tone="blue"
        value={members.data ? active.length : '–'}
        unit="players"
        footer={joinedThisMonth > 0 && <Badge tone="green">+{joinedThisMonth} this month</Badge>}
        footerNote="Active roster"
      />
      <StatCard
        label="Today’s attendance"
        icon="checkCircle"
        tone="red"
        value={todaySessionId ? `${present} / ${expected}` : '–'}
        unit={todaySessionId ? 'checked in' : 'no session today'}
        footer={
          todaySessionId &&
          expected > 0 && (
            <Badge tone="red">{Math.round((100 * present) / expected)}% present</Badge>
          )
        }
        footerNote={todaySessionId ? 'Evening session' : undefined}
      />
      <StatCard
        label="Fines received"
        icon="cash"
        tone="amber"
        value={payments.data ? formatNpr(collected) : '–'}
        footer={<Badge tone="amber">{monthLabel(month)}</Badge>}
        footerNote={`${live.length} payment${live.length === 1 ? '' : 's'}`}
      />
      <StatCard
        label="Outstanding fines"
        icon="receipt"
        tone="purple"
        value={pending.data ? formatNpr(outstanding) : '–'}
        footer={
          <Link to="/fines" className="font-semibold text-purple-600 hover:underline">
            View fines
          </Link>
        }
        footerNote={`${owing} member${owing === 1 ? '' : 's'} owing`}
      />
    </div>
  )
}

function AttendanceOverview() {
  const [period, setPeriod] = useState<'month' | 'week'>('month')
  const today = nepalToday()
  const range =
    period === 'month' ? monthRange(currentMonth()) : { from: addDays(today, -6), to: today }
  const report = useTeamReport({ from: range.from, to: today < range.to ? today : range.to })

  const totals = (report.data ?? []).reduce(
    (sum, row) => ({
      present: sum.present + row.on_time + row.late,
      absent: sum.absent + row.absent,
      excused: sum.excused + row.excused,
    }),
    { present: 0, absent: 0, excused: 0 },
  )
  const all = totals.present + totals.absent + totals.excused
  const percent = all ? Math.round((100 * totals.present) / all) : null

  return (
    <Card className="flex h-full flex-col justify-between p-6">
      <div>
        <CardHeader
          title="Attendance overview"
          description={period === 'month' ? 'Squad participation this month' : 'Last 7 days'}
          actions={
            <Segmented
              label="Period"
              value={period}
              onChange={setPeriod}
              options={[
                { value: 'month', label: 'This month' },
                { value: 'week', label: 'This week' },
              ]}
            />
          }
        />
        <div className="my-6">
          {report.isError ? (
            <FormError message={errorMessage(report.error)} />
          ) : (
            <Donut
              label={`Attendance: ${totals.present} present, ${totals.absent} absent, ${totals.excused} excused`}
              centre={percent === null ? '–' : `${percent}%`}
              caption="Present"
              slices={[
                { label: 'Present', value: totals.present, color: chartColors.present },
                { label: 'Absent', value: totals.absent, color: chartColors.absent },
                { label: 'Excused', value: totals.excused, color: chartColors.excused },
              ]}
            />
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 border-t border-gray-50 pt-5">
        {(
          [
            ['Present', totals.present, chartColors.present, 'bg-blue-50/60'],
            ['Absent', totals.absent, chartColors.absent, 'bg-rose-50/60'],
            ['Excused', totals.excused, chartColors.excused, 'bg-purple-50/60'],
          ] as const
        ).map(([label, value, color, bg]) => (
          <div key={label} className={`rounded-xl p-3 ${bg}`}>
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs font-semibold text-gray-700">{label}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold text-gray-900 tabular-nums">{value}</span>
              <span className="text-xs font-medium text-gray-500">
                {all ? `${Math.round((100 * value) / all)}%` : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function pick(rows: ReportRow[], score: (row: ReportRow) => number) {
  return rows.reduce<ReportRow | null>(
    (best, row) => (best === null || score(row) > score(best) ? row : best),
    null,
  )
}

function Highlights() {
  const month = currentMonth()
  const today = nepalToday()
  const range = monthRange(month)
  const report = useTeamReport({ from: range.from, to: today < range.to ? today : range.to })
  const rows = (report.data ?? []).filter((row) => row.sessions > 0)

  const best = pick(rows, (row) => (row.attendance_percent ?? 0) * 1000 + row.on_time)
  const absentee = pick(rows, (row) => row.absent)
  const fined = pick(rows, (row) => row.fines_npr)

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-base font-bold tracking-tight text-gray-900">
            Key member highlights
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">{monthLabel(month)} attendance and fines</p>
        </div>
        <Link
          to="/members"
          className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          View all members <Icon name="chevronRight" className="h-3.5 w-3.5" />
        </Link>
      </div>
      {report.isPending && <LoadingRows rows={3} />}
      {report.isError && <FormError message={errorMessage(report.error)} />}
      {report.data && rows.length === 0 && (
        <Card>
          <EmptyState icon="chart" title="No finished sessions this month yet">
            Highlights appear after the first session closes.
          </EmptyState>
        </Card>
      )}
      {best && (
        <Highlight
          row={best}
          badge={<Badge tone="green">Best attendance</Badge>}
          detail={`${best.on_time + best.late} of ${best.sessions} sessions · ${best.on_time} on time`}
          aside={<Badge tone="green">{best.attendance_percent}% present</Badge>}
        />
      )}
      {absentee && absentee.absent > 0 && (
        <Highlight
          row={absentee}
          badge={<Badge tone="red">Most absences</Badge>}
          detail={`${absentee.on_time + absentee.late} of ${absentee.sessions} sessions attended`}
          aside={
            <Badge tone="red">
              {absentee.absent} absence{absentee.absent === 1 ? '' : 's'}
            </Badge>
          }
        />
      )}
      {fined && fined.fines_npr > 0 && (
        <Highlight
          row={fined}
          badge={<Badge tone="amber">Highest fines</Badge>}
          detail={`${fined.late} late · ${fined.absent} unexcused absence${fined.absent === 1 ? '' : 's'}`}
          aside={
            <span className="flex flex-col items-end gap-1">
              <span className="text-sm font-bold text-gray-900">{formatNpr(fined.fines_npr)}</span>
              {fined.fines_outstanding_npr === 0 ? (
                <Badge tone="green">✓ Settled</Badge>
              ) : (
                <Badge tone="red">{formatNpr(fined.fines_outstanding_npr)} due</Badge>
              )}
            </span>
          }
        />
      )}
    </div>
  )
}

function Highlight({
  row,
  badge,
  detail,
  aside,
}: {
  row: ReportRow
  badge: ReactNode
  detail: string
  aside: ReactNode
}) {
  return (
    <Card className="flex items-center justify-between gap-4 p-4">
      <div className="flex min-w-0 items-center gap-3.5">
        <Avatar name={row.display_name} size="lg" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-bold text-gray-900">{row.display_name}</h3>
            {badge}
          </div>
          <p className="mt-1 text-xs text-gray-400">{detail}</p>
        </div>
      </div>
      <div className="shrink-0 text-right">{aside}</div>
    </Card>
  )
}
