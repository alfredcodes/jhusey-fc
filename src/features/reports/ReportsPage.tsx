import { useMemo, useState } from 'react'
import { ColumnChart, Donut, StackedColumnChart } from '../../components/charts.tsx'
import { chartColors } from '../../components/chart-colors.ts'
import { FormError, secondaryButtonClass, smallButtonClass } from '../../components/form.tsx'
import { Icon } from '../../components/icons.tsx'
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  LoadingRows,
  PageHeader,
  Segmented,
  SelectFilter,
  StatCard,
  Td,
  Th,
  TableFrame,
} from '../../components/ui.tsx'
import { formatNpr } from '../../lib/format.ts'
import { downloadCsv, toCsv, type CsvColumn } from '../../lib/csv.ts'
import { errorMessage } from '../../lib/errors.ts'
import { formatCalendarDate, nepalToday } from '../../lib/nepal-time.ts'
import { supabase } from '../../lib/supabase.ts'
import {
  currentMonth,
  monthLabel,
  monthRange,
  teamPayments,
  teamReport,
  useIsAdmin,
  useMonthlySummary,
  useTeamPayments,
  useTeamReport,
  type Range,
  type ReportRow,
} from '../team/queries.ts'

type Mode = 'month' | 'year' | 'custom'

const reportColumns: CsvColumn<ReportRow>[] = [
  { header: 'Member', value: (r) => r.display_name },
  { header: 'Active', value: (r) => (r.is_active ? 'yes' : 'no') },
  { header: 'Sessions', value: (r) => r.sessions },
  { header: 'On time', value: (r) => r.on_time },
  { header: 'Late', value: (r) => r.late },
  { header: 'Absent', value: (r) => r.absent },
  { header: 'Excused', value: (r) => r.excused },
  { header: 'Attendance %', value: (r) => r.attendance_percent },
  { header: 'Late fines (NPR)', value: (r) => r.late_fines_npr },
  { header: 'Absence fines (NPR)', value: (r) => r.absence_fines_npr },
  { header: 'Fines assigned (NPR)', value: (r) => r.fines_npr },
  { header: 'Paid (NPR)', value: (r) => r.fines_paid_npr },
  { header: 'Waived (NPR)', value: (r) => r.fines_waived_npr },
  { header: 'Outstanding (NPR)', value: (r) => r.fines_outstanding_npr },
]

/** Uses every column the database returns, so backups never silently drop data. */
function allColumns<T extends object>(rows: T[]): CsvColumn<T>[] {
  const keys = rows.length > 0 ? (Object.keys(rows[0]) as (keyof T)[]) : []
  return keys.map((key) => ({ header: String(key), value: (row: T) => row[key] }))
}

async function adminRows(
  name: 'admin_export_attendance' | 'admin_export_fines' | 'admin_export_payments',
  range: Range,
) {
  const { data, error } = await supabase.rpc(name, { p_from: range.from, p_to: range.to })
  if (error) throw error
  return (data ?? []) as object[]
}

function shortMonth(isoDate: string) {
  const [year, month] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
}

export default function ReportsPage() {
  const isAdmin = useIsAdmin()
  const today = nepalToday()
  const [mode, setMode] = useState<Mode>('month')
  const [month, setMonth] = useState(currentMonth())
  const [year, setYear] = useState(today.slice(0, 4))
  const [custom, setCustom] = useState<Range>({ from: `${currentMonth()}-01`, to: today })
  const [sort, setSort] = useState('name')
  const [exporting, setExporting] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const range: Range =
    mode === 'month'
      ? monthRange(month)
      : mode === 'year'
        ? { from: `${year}-01-01`, to: `${year}-12-31` }
        : custom
  // Never ask about the future: it has no results yet.
  const capped = { from: range.from, to: range.to > today ? today : range.to }
  const valid = capped.from <= capped.to
  const report = useTeamReport(valid ? capped : range)
  const monthly = useMonthlySummary(valid ? capped : range)
  const payments = useTeamPayments(valid ? capped : range)

  const rows = useMemo(() => {
    const list = [...(report.data ?? [])]
    const by: Record<string, (a: ReportRow, b: ReportRow) => number> = {
      name: (a, b) => a.display_name.localeCompare(b.display_name),
      attendance: (a, b) => (b.attendance_percent ?? -1) - (a.attendance_percent ?? -1),
      late: (a, b) => b.late - a.late,
      absent: (a, b) => b.absent - a.absent,
      fines: (a, b) => b.fines_npr - a.fines_npr,
    }
    return list.sort(by[sort])
  }, [report.data, sort])

  const t = rows.reduce(
    (sum, r) => ({
      sessions: sum.sessions + r.sessions,
      onTime: sum.onTime + r.on_time,
      late: sum.late + r.late,
      absent: sum.absent + r.absent,
      excused: sum.excused + r.excused,
      assigned: sum.assigned + r.fines_npr,
      paid: sum.paid + r.fines_paid_npr,
      waived: sum.waived + r.fines_waived_npr,
      outstanding: sum.outstanding + r.fines_outstanding_npr,
      lateNpr: sum.lateNpr + r.late_fines_npr,
      absenceNpr: sum.absenceNpr + r.absence_fines_npr,
    }),
    {
      sessions: 0,
      onTime: 0,
      late: 0,
      absent: 0,
      excused: 0,
      assigned: 0,
      paid: 0,
      waived: 0,
      outstanding: 0,
      lateNpr: 0,
      absenceNpr: 0,
    },
  )
  const attended = t.onTime + t.late
  const percent = t.sessions ? Math.round((100 * attended) / t.sessions) : null
  const collected = (payments.data ?? [])
    .filter((p) => !p.voided)
    .reduce((sum, p) => sum + p.amount_npr, 0)
  const sessionsHeld = (monthly.data ?? []).reduce((sum, m) => sum + m.sessions, 0)
  const activeMembers = rows.filter((r) => r.is_active).length
  const months = monthly.data ?? []

  const label =
    mode === 'month'
      ? monthLabel(month)
      : mode === 'year'
        ? year
        : `${formatCalendarDate(custom.from)} – ${formatCalendarDate(custom.to)}`

  async function exportCsv(name: string, load: () => Promise<string>) {
    setExportError(null)
    setExporting(name)
    try {
      downloadCsv(`jhusey-fc-${name}-${capped.from}_to_${capped.to}.csv`, await load())
    } catch (caught) {
      setExportError(errorMessage(caught))
    } finally {
      setExporting(null)
    }
  }

  const exports = [
    {
      name: 'report',
      label: 'Team report',
      load: async () => toCsv(await teamReport(capped), reportColumns),
      admin: false,
    },
    {
      name: 'payments-summary',
      label: 'Payments',
      load: async () => {
        const data = await teamPayments(capped)
        return toCsv(data, allColumns(data))
      },
      admin: false,
    },
    {
      name: 'attendance',
      label: 'Attendance + GPS (backup)',
      load: async () => {
        const d = await adminRows('admin_export_attendance', capped)
        return toCsv(d, allColumns(d))
      },
      admin: true,
    },
    {
      name: 'fines',
      label: 'Fines (backup)',
      load: async () => {
        const d = await adminRows('admin_export_fines', capped)
        return toCsv(d, allColumns(d))
      },
      admin: true,
    },
    {
      name: 'payments',
      label: 'Payments + notes (backup)',
      load: async () => {
        const d = await adminRows('admin_export_payments', capped)
        return toCsv(d, allColumns(d))
      },
      admin: true,
    },
  ].filter((item) => isAdmin || !item.admin)

  const years = Array.from({ length: 4 }, (_, index) => String(Number(today.slice(0, 4)) - index))

  return (
    <>
      <PageHeader
        title="Reports"
        badges={<Badge tone="blue">{label}</Badge>}
        description="Team attendance and fines, calculated from the database. Everyone sees the same numbers."
        actions={
          <button
            type="button"
            className={secondaryButtonClass}
            disabled={exporting !== null || !valid}
            onClick={() => exportCsv('report', exports[0].load)}
          >
            <Icon name="download" className="h-4 w-4" /> Export CSV
          </button>
        }
      />

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          label="Report period"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'month', label: 'Month' },
            { value: 'year', label: 'Year' },
            { value: 'custom', label: 'Date range' },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          {mode === 'month' && (
            <label>
              <span className="sr-only">Month</span>
              <input
                type="month"
                value={month}
                max={currentMonth()}
                onChange={(event) => event.target.value && setMonth(event.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
          )}
          {mode === 'year' && (
            <SelectFilter
              label="Year"
              value={year}
              onChange={setYear}
              options={years.map((y) => ({ value: y, label: y }))}
            />
          )}
          {mode === 'custom' && (
            <>
              <label className="text-xs text-gray-500">
                From{' '}
                <input
                  type="date"
                  value={custom.from}
                  max={custom.to}
                  onChange={(event) =>
                    event.target.value && setCustom({ ...custom, from: event.target.value })
                  }
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800"
                />
              </label>
              <label className="text-xs text-gray-500">
                To{' '}
                <input
                  type="date"
                  value={custom.to}
                  min={custom.from}
                  onChange={(event) =>
                    event.target.value && setCustom({ ...custom, to: event.target.value })
                  }
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800"
                />
              </label>
            </>
          )}
        </div>
      </Card>

      {!valid && <FormError message="This period has not started yet." />}
      {report.isError && <FormError message={errorMessage(report.error)} />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Members"
          icon="team"
          tone="blue"
          value={report.data ? activeMembers : '–'}
          unit="active"
        />
        <StatCard
          label="Sessions held"
          icon="calendar"
          tone="purple"
          value={monthly.data ? sessionsHeld : '–'}
          unit="closed sessions"
        />
        <StatCard
          label="Team attendance"
          icon="checkCircle"
          tone="green"
          value={percent === null ? '–' : `${percent}%`}
          footerNote={`${attended} of ${t.sessions} member-sessions`}
        />
        <StatCard
          label="On time · Late"
          icon="clock"
          tone="amber"
          value={`${t.onTime} · ${t.late}`}
          footerNote={`${t.absent} absent · ${t.excused} excused`}
        />
        <StatCard
          label="Fines assigned"
          icon="receipt"
          tone="red"
          value={formatNpr(t.assigned)}
          footerNote={`Late ${formatNpr(t.lateNpr)} · Absence ${formatNpr(t.absenceNpr)}`}
        />
        <StatCard
          label="Collected"
          icon="cash"
          tone="green"
          value={formatNpr(collected)}
          footerNote="Payments recorded in this period"
        />
        <StatCard
          label="Outstanding"
          icon="warning"
          tone="amber"
          value={formatNpr(t.outstanding)}
          footerNote="Fines for sessions in this period"
        />
        <StatCard
          label="Waived"
          icon="ban"
          tone="gray"
          value={formatNpr(t.waived)}
          footerNote="Not counted as assigned"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="p-6 lg:col-span-5">
          <CardHeader title="Attendance breakdown" description={label} />
          <div className="my-6">
            <Donut
              label={`On time ${t.onTime}, late ${t.late}, absent ${t.absent}, excused ${t.excused}`}
              centre={percent === null ? '–' : `${percent}%`}
              caption="Attended"
              slices={[
                { label: 'On time', value: t.onTime, color: chartColors.present },
                { label: 'Late', value: t.late, color: chartColors.late },
                { label: 'Absent', value: t.absent, color: chartColors.absent },
                { label: 'Excused', value: t.excused, color: chartColors.excused },
              ]}
            />
          </div>
          <ul className="grid grid-cols-2 gap-2 text-xs">
            {(
              [
                ['On time', t.onTime, chartColors.present],
                ['Late', t.late, chartColors.late],
                ['Absent', t.absent, chartColors.absent],
                ['Excused', t.excused, chartColors.excused],
              ] as const
            ).map(([name, value, color]) => (
              <li
                key={name}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
              >
                <span className="flex items-center gap-2 text-gray-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  {name}
                </span>
                <span className="font-semibold text-gray-900 tabular-nums">{value}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-8 p-6 lg:col-span-7">
          <div>
            <CardHeader title="Attendance trend" description="Team attendance % per month" />
            <div className="mt-4">
              {monthly.isPending ? (
                <LoadingRows rows={2} />
              ) : months.length < 2 ? (
                <p className="text-sm text-gray-500">
                  Choose a year or a longer date range to see the trend by month.
                </p>
              ) : (
                <ColumnChart
                  label="Team attendance percentage per month"
                  max={100}
                  data={months.map((m) => {
                    const value = m.member_sessions
                      ? Math.round((100 * m.attended) / m.member_sessions)
                      : 0
                    return {
                      label: shortMonth(m.month),
                      value,
                      display: m.member_sessions ? `${value}%` : '–',
                    }
                  })}
                />
              )}
            </div>
          </div>
          {months.length >= 2 && (
            <div>
              <CardHeader title="Fines by month" description="Assigned (not waived), in rupees" />
              <div className="mt-4">
                <StackedColumnChart
                  label="Late and absence fines per month"
                  series={[
                    { name: 'Late', color: chartColors.late },
                    { name: 'Absence', color: chartColors.absent },
                  ]}
                  data={months.map((m) => ({
                    label: shortMonth(m.month),
                    values: [m.late_fines_npr, m.absence_fines_npr],
                  }))}
                />
              </div>
            </div>
          )}
        </Card>
      </div>

      {months.length >= 2 && (
        <Card>
          <div className="border-b border-gray-100 p-5">
            <CardHeader
              title="Monthly financial summary"
              description="Fines by session month; collected by payment date"
            />
          </div>
          <TableFrame caption="Monthly summary">
            <thead className="border-b border-gray-100 bg-gray-50/60">
              <tr>
                <Th>Month</Th>
                <Th align="right">Sessions</Th>
                <Th align="right">Attendance</Th>
                <Th align="right">Late fines</Th>
                <Th align="right">Absence fines</Th>
                <Th align="right">Collected</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {months.map((m) => (
                <tr key={m.month}>
                  <Td className="font-semibold text-gray-900">{monthLabel(m.month.slice(0, 7))}</Td>
                  <Td align="right">{m.sessions}</Td>
                  <Td align="right">
                    {m.member_sessions
                      ? `${Math.round((100 * m.attended) / m.member_sessions)}%`
                      : '–'}
                  </Td>
                  <Td align="right">{formatNpr(m.late_fines_npr)}</Td>
                  <Td align="right">{formatNpr(m.absence_fines_npr)}</Td>
                  <Td align="right" className="font-semibold text-emerald-600">
                    {formatNpr(m.collected_npr)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        </Card>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <CardHeader title="Member-wise summary" description="Attendance and fines per member" />
          <SelectFilter
            label="Sort"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'name', label: 'Sort: Name' },
              { value: 'attendance', label: 'Sort: Attendance' },
              { value: 'late', label: 'Sort: Most late' },
              { value: 'absent', label: 'Sort: Most absent' },
              { value: 'fines', label: 'Sort: Most fines' },
            ]}
          />
        </div>
        {report.isPending && <LoadingRows />}
        {report.data && rows.length === 0 && (
          <EmptyState icon="chart" title="No data for this period" />
        )}
        {rows.length > 0 && (
          <TableFrame caption="Attendance and fines per member">
            <thead className="border-b border-gray-100 bg-gray-50/60">
              <tr>
                <Th>Member</Th>
                <Th align="right">Sessions</Th>
                <Th align="right">On time</Th>
                <Th align="right">Late</Th>
                <Th align="right">Absent</Th>
                <Th align="right" className="hidden sm:table-cell">
                  Excused
                </Th>
                <Th align="right">%</Th>
                <Th align="right">Fines</Th>
                <Th align="right" className="hidden sm:table-cell">
                  Paid
                </Th>
                <Th align="right">Due</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => (
                <tr key={r.member_id} className={r.is_active ? '' : 'text-gray-400'}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.display_name} size="sm" />
                      <span className="font-semibold whitespace-nowrap text-gray-900">
                        {r.display_name}
                        {!r.is_active && ' (inactive)'}
                      </span>
                    </div>
                  </Td>
                  <Td align="right">{r.sessions}</Td>
                  <Td align="right">{r.on_time}</Td>
                  <Td align="right">{r.late}</Td>
                  <Td align="right">{r.absent}</Td>
                  <Td align="right" className="hidden sm:table-cell">
                    {r.excused}
                  </Td>
                  <Td align="right" className="font-semibold">
                    {r.attendance_percent === null ? '–' : `${r.attendance_percent}%`}
                  </Td>
                  <Td align="right">{r.fines_npr.toLocaleString('en-IN')}</Td>
                  <Td align="right" className="hidden sm:table-cell">
                    {r.fines_paid_npr.toLocaleString('en-IN')}
                  </Td>
                  <Td
                    align="right"
                    className={r.fines_outstanding_npr > 0 ? 'font-semibold text-rose-600' : ''}
                  >
                    {r.fines_outstanding_npr.toLocaleString('en-IN')}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <CardHeader
          title="Download CSV"
          description={
            isAdmin
              ? 'The free Supabase plan has no downloadable backups: download the backup files regularly. The attendance file contains members’ GPS locations, so share it with care.'
              : 'Download the team numbers for this period.'
          }
        />
        <div className="flex flex-wrap gap-2">
          {exports.map((item) => (
            <button
              key={item.name}
              type="button"
              disabled={exporting !== null || !valid}
              className={smallButtonClass}
              onClick={() => exportCsv(item.name, item.load)}
            >
              <Icon name="download" className="h-3.5 w-3.5" />
              {exporting === item.name ? 'Preparing…' : item.label}
            </button>
          ))}
        </div>
        <FormError message={exportError} />
      </Card>
    </>
  )
}
