import { useState } from 'react'
import { FormError, inputClass } from '../../components/form.tsx'
import { errorMessage } from '../../lib/errors.ts'
import { formatCalendarDate } from '../../lib/nepal-time.ts'
import AttendanceStatusBadge from '../attendance/AttendanceStatusBadge.tsx'
import { useRecentSessions, useTeamAttendance } from './queries.ts'

/** Who punched in for a session: names and On Time/Late only. No locations, times or fines. */
export default function TeamPage() {
  const sessions = useRecentSessions()
  const [chosen, setChosen] = useState<string | null>(null)
  const sessionId = chosen ?? sessions.data?.[0]?.id
  const team = useTeamAttendance(sessionId)

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Team attendance</h1>

      {sessions.isError && <FormError message={errorMessage(sessions.error)} />}
      {sessions.data?.length === 0 && <p className="text-slate-600">No sessions yet.</p>}

      {sessions.data && sessions.data.length > 0 && (
        <label className="block text-sm font-medium">
          Session
          <select
            className={inputClass}
            value={sessionId}
            onChange={(event) => setChosen(event.target.value)}
          >
            {sessions.data.map((session) => (
              <option key={session.id} value={session.id}>
                {formatCalendarDate(session.session_date)}
              </option>
            ))}
          </select>
        </label>
      )}

      {team.isError && <FormError message={errorMessage(team.error)} />}
      {team.data?.length === 0 && (
        <p className="text-slate-600">Nobody has punched in for this session.</p>
      )}
      {team.data && team.data.length > 0 && (
        <>
          <p className="text-sm text-slate-600">
            {team.data.length} punched in ·{' '}
            {team.data.filter((row) => row.status === 'on_time').length} on time
          </p>
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {team.data.map((row, index) => (
              <li key={index} className="flex items-center justify-between px-4 py-2.5">
                <span className="font-medium">{row.display_name}</span>
                <AttendanceStatusBadge status={row.status} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
