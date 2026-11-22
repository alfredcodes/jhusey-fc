import { FormError } from '../../components/form.tsx'
import { errorMessage } from '../../lib/errors.ts'
import { formatNepalDate, formatNepalTime } from '../../lib/nepal-time.ts'
import { useAuditLog } from './queries.ts'

const actionLabels: Record<string, string> = {
  'attendance.corrected': 'Attendance corrected',
  'attendance.recorded': 'Attendance recorded by admin',
  'fine.waived': 'Fine waived',
  'payment.recorded': 'Payment recorded',
  'payment.voided': 'Payment voided',
  'member.updated': 'Member updated',
}

function describe(action: string, details: Record<string, unknown>): string {
  switch (action) {
    case 'attendance.corrected':
      return `${details.from} → ${details.to}; fine ${details.fine}`
    case 'attendance.recorded':
      return `arrived ${String(details.arrived_at).slice(0, 5)}, ${details.status}`
    case 'payment.recorded':
    case 'payment.voided':
    case 'fine.waived':
      return `NPR ${details.amount_npr}`
    case 'member.updated': {
      const from = details.from as { display_name: string; is_active: boolean }
      const to = details.to as { display_name: string; is_active: boolean }
      const changes = []
      if (from.display_name !== to.display_name)
        changes.push(`${from.display_name} → ${to.display_name}`)
      if (from.is_active !== to.is_active) changes.push(to.is_active ? 'activated' : 'deactivated')
      return changes.join('; ') || 'no change'
    }
    default:
      return ''
  }
}

/** Read-only record of every admin action. Nobody can edit or delete it from the app. */
export default function AdminAuditPage() {
  const log = useAuditLog()

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Audit log</h1>
      {log.isPending && <p className="text-slate-600">Loading…</p>}
      {log.isError && <FormError message={errorMessage(log.error)} />}
      {log.data?.length === 0 && <p className="text-slate-600">No admin actions yet.</p>}
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {log.data?.map((entry) => {
          const at = new Date(entry.created_at)
          return (
            <li key={entry.id} className="px-4 py-3 text-sm">
              <p className="font-medium">
                {actionLabels[entry.action] ?? entry.action}
                <span className="font-normal text-slate-600">
                  {' '}
                  · {describe(entry.action, entry.details as Record<string, unknown>)}
                </span>
              </p>
              <p className="text-slate-600">
                {formatNepalDate(at)} {formatNepalTime(at)} · by {entry.actor?.display_name}
                {entry.reason && ` · “${entry.reason}”`}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
