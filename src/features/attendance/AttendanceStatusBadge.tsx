import type { AttendanceStatus } from './queries.ts'

/** Text plus colour, so the status is never shown by colour alone. */
export default function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return status === 'late' ? (
    <span className="rounded bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-900">
      Late
    </span>
  ) : (
    <span className="rounded bg-emerald-100 px-2 py-0.5 text-sm font-semibold text-emerald-900">
      On time
    </span>
  )
}
