import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { FormError, inputClass, smallButtonClass } from '../../components/form.tsx'
import { downloadCsv, toCsv, type CsvColumn } from '../../lib/csv.ts'
import { errorMessage } from '../../lib/errors.ts'
import { nepalToday } from '../../lib/nepal-time.ts'
import { supabase } from '../../lib/supabase.ts'

type Range = { from: string; to: string }

/** These functions return a list of rows; an empty result is an empty list, never null. */
async function call<T>(promise: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const { data, error } = await promise
  if (error) throw error
  return data ?? []
}

const fetchReport = (r: Range) =>
  call(supabase.rpc('admin_attendance_report', { p_from: r.from, p_to: r.to }))
const fetchAttendance = (r: Range) =>
  call(supabase.rpc('admin_export_attendance', { p_from: r.from, p_to: r.to }))
const fetchFines = (r: Range) =>
  call(supabase.rpc('admin_export_fines', { p_from: r.from, p_to: r.to }))
const fetchPayments = (r: Range) =>
  call(supabase.rpc('admin_export_payments', { p_from: r.from, p_to: r.to }))

type ReportRow = Awaited<ReturnType<typeof fetchReport>>[number]

const reportColumns: CsvColumn<ReportRow>[] = [
  { header: 'Member', value: (r) => r.display_name },
  { header: 'Active', value: (r) => (r.is_active ? 'yes' : 'no') },
  { header: 'Sessions', value: (r) => r.sessions },
  { header: 'On time', value: (r) => r.on_time },
  { header: 'Late', value: (r) => r.late },
  { header: 'Absent', value: (r) => r.absent },
  { header: 'Attendance %', value: (r) => r.attendance_percent },
  { header: 'Fines assigned (NPR)', value: (r) => r.fines_npr },
  { header: 'Paid (NPR)', value: (r) => r.fines_paid_npr },
  { header: 'Waived (NPR)', value: (r) => r.fines_waived_npr },
  { header: 'Outstanding (NPR)', value: (r) => r.fines_outstanding_npr },
]

/** Uses every column the database returns, so exports never silently drop data. */
function allColumns<T extends object>(rows: T[]): CsvColumn<T>[] {
  const keys = rows.length > 0 ? (Object.keys(rows[0]) as (keyof T)[]) : []
  return keys.map((key) => ({ header: String(key), value: (row: T) => row[key] }))
}

function firstOfMonth(isoDate: string) {
  return `${isoDate.slice(0, 8)}01`
}

export default function AdminReportsPage() {
  const today = nepalToday()
  const [range, setRange] = useState<Range>({ from: firstOfMonth(today), to: today })
  const report = useQuery({ queryKey: ['report', range], queryFn: () => fetchReport(range) })
  const payments = useQuery({
    queryKey: ['report', 'payments', range],
    queryFn: () => fetchPayments(range),
  })
  const [exportError, setExportError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)

  const rows = report.data ?? []
  const totals = rows.reduce(
    (sum, r) => ({
      sessions: sum.sessions + r.sessions,
      attended: sum.attended + r.on_time + r.late,
      assigned: sum.assigned + r.fines_npr,
      paid: sum.paid + r.fines_paid_npr,
      waived: sum.waived + r.fines_waived_npr,
      outstanding: sum.outstanding + r.fines_outstanding_npr,
    }),
    { sessions: 0, attended: 0, assigned: 0, paid: 0, waived: 0, outstanding: 0 },
  )
  const collected = (payments.data ?? [])
    .filter((p) => p.voided_nepal === null)
    .reduce((sum, p) => sum + p.amount_npr, 0)

  async function exportCsv(name: string, load: () => Promise<string>) {
    setExportError(null)
    setExporting(name)
    try {
      downloadCsv(`jhusey-fc-${name}-${range.from}_to_${range.to}.csv`, await load())
    } catch (caught) {
      setExportError(errorMessage(caught))
    } finally {
      setExporting(null)
    }
  }

  const exports = [
    {
      name: 'report',
      label: 'Report',
      load: async () => toCsv(await fetchReport(range), reportColumns),
    },
    {
      name: 'attendance',
      label: 'Attendance + GPS',
      load: async () => {
        const data = await fetchAttendance(range)
        return toCsv(data, allColumns(data))
      },
    },
    {
      name: 'fines',
      label: 'Fines',
      load: async () => {
        const data = await fetchFines(range)
        return toCsv(data, allColumns(data))
      },
    },
    {
      name: 'payments',
      label: 'Payments',
      load: async () => {
        const data = await fetchPayments(range)
        return toCsv(data, allColumns(data))
      },
    },
  ]

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Reports</h1>

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <label className="text-sm font-medium">
          From
          <input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className="text-sm font-medium">
          To
          <input
            type="date"
            value={range.to}
            min={range.from}
            onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })}
            className={inputClass}
          />
        </label>
      </div>

      {report.isError && <FormError message={errorMessage(report.error)} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          label="Team attendance"
          value={
            totals.sessions ? `${Math.round((100 * totals.attended) / totals.sessions)}%` : '–'
          }
          note={`${totals.attended} of ${totals.sessions} member-sessions`}
        />
        <Tile
          label="Fines assigned"
          value={`NPR ${totals.assigned}`}
          note={`Waived NPR ${totals.waived}`}
        />
        <Tile label="Outstanding" value={`NPR ${totals.outstanding}`} />
        <Tile label="Collected" value={`NPR ${collected}`} note="Payments recorded in this range" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <caption className="sr-only">Attendance and fines per member</caption>
          <thead className="bg-slate-50 text-left text-xs text-slate-600 uppercase">
            <tr>
              <th className="px-3 py-2">Member</th>
              <th className="px-3 py-2 text-right">Sessions</th>
              <th className="px-3 py-2 text-right">On time</th>
              <th className="px-3 py-2 text-right">Late</th>
              <th className="px-3 py-2 text-right">Absent</th>
              <th className="px-3 py-2 text-right">%</th>
              <th className="px-3 py-2 text-right">Fines</th>
              <th className="px-3 py-2 text-right">Paid</th>
              <th className="px-3 py-2 text-right">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {report.isPending && (
              <tr>
                <td colSpan={9} className="px-3 py-3 text-slate-600">
                  Loading…
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.member_id} className={r.is_active ? '' : 'text-slate-500'}>
                <td className="px-3 py-2 font-medium">
                  {r.display_name}
                  {!r.is_active && ' (inactive)'}
                </td>
                <td className="px-3 py-2 text-right">{r.sessions}</td>
                <td className="px-3 py-2 text-right">{r.on_time}</td>
                <td className="px-3 py-2 text-right">{r.late}</td>
                <td className="px-3 py-2 text-right">{r.absent}</td>
                <td className="px-3 py-2 text-right">{r.attendance_percent ?? '–'}</td>
                <td className="px-3 py-2 text-right">{r.fines_npr}</td>
                <td className="px-3 py-2 text-right">{r.fines_paid_npr}</td>
                <td className="px-3 py-2 text-right">{r.fines_outstanding_npr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Download CSV (backup)</h2>
        <p className="text-sm text-slate-600">
          The free Supabase plan has no downloadable backups. Download these regularly and keep them
          somewhere safe. The attendance file contains members’ GPS locations: share it with care.
        </p>
        <div className="flex flex-wrap gap-2">
          {exports.map((item) => (
            <button
              key={item.name}
              type="button"
              disabled={exporting !== null}
              className={smallButtonClass}
              onClick={() => exportCsv(item.name, item.load)}
            >
              {exporting === item.name ? 'Preparing…' : item.label}
            </button>
          ))}
        </div>
        <FormError message={exportError} />
      </div>
    </section>
  )
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium text-slate-600 uppercase">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {note && <p className="text-xs text-slate-600">{note}</p>}
    </div>
  )
}
