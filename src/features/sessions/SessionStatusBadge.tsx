import type { SessionRow } from './queries.ts'

/** Text plus colour, so the status is never communicated by colour alone. */
export default function SessionStatusBadge({ status }: { status: SessionRow['status'] }) {
  return status === 'cancelled' ? (
    <span className="ml-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
      Cancelled
    </span>
  ) : (
    <span className="ml-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
      Scheduled
    </span>
  )
}
