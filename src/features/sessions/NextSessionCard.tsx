import { FormError } from '../../components/form.tsx'
import { errorMessage } from '../../lib/errors.ts'
import { formatCalendarDate, nepalToday } from '../../lib/nepal-time.ts'
import { useUpcomingSessions } from './queries.ts'
import SessionStatusBadge from './SessionStatusBadge.tsx'

/** Member view: the next scheduled session plus the next few dates. */
export default function NextSessionCard() {
  const sessions = useUpcomingSessions(10)

  if (sessions.isPending) return <p className="text-slate-600">Loading sessions…</p>
  if (sessions.isError) return <FormError message={errorMessage(sessions.error)} />

  const next = sessions.data.find((session) => session.status === 'scheduled')
  const isToday = next?.session_date === nepalToday()

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-emerald-800">
          {isToday ? 'Today’s session' : 'Next session'}
        </p>
        {next ? (
          <>
            <p className="mt-1 text-xl font-semibold">{formatCalendarDate(next.session_date)}</p>
            <p className="text-slate-600">{next.venue?.name}</p>
            <p className="mt-2 text-sm">
              Punch in by <strong>7:15 PM</strong>. From 7:15:01 PM it counts as late (NPR 50).
            </p>
          </>
        ) : (
          <p className="mt-1 text-slate-600">No sessions scheduled yet.</p>
        )}
      </div>

      {sessions.data.length > 0 && (
        <div>
          <h2 className="mb-2 font-semibold">Upcoming</h2>
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {sessions.data.map((session) => (
              <li key={session.id} className="flex items-center justify-between px-4 py-2.5">
                <span
                  className={session.status === 'cancelled' ? 'text-slate-500 line-through' : ''}
                >
                  {formatCalendarDate(session.session_date)}
                </span>
                <SessionStatusBadge status={session.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
