import { FormError } from '../../components/form.tsx'
import { errorMessage } from '../../lib/errors.ts'
import { formatNepalTime, nepalToday } from '../../lib/nepal-time.ts'
import { useUpcomingSessions } from '../sessions/queries.ts'
import AttendanceStatusBadge from './AttendanceStatusBadge.tsx'
import { evidenceText } from './evidence.ts'
import { useActiveMembers, useSessionAttendance } from './queries.ts'

/** Admin dashboard: who has punched in for today's session, and who has not yet. */
export default function AdminTodayAttendance() {
  const sessions = useUpcomingSessions(1)
  const today = sessions.data?.find(
    (s) => s.session_date === nepalToday() && s.status === 'scheduled',
  )
  const attendance = useSessionAttendance(today?.id)
  const members = useActiveMembers()

  if (sessions.isPending) return null
  if (!today) {
    return <p className="text-slate-600">No session today.</p>
  }
  if (attendance.isError) return <FormError message={errorMessage(attendance.error)} />

  const punched = attendance.data ?? []
  const punchedIds = new Set(punched.map((row) => row.member_id))
  const notYet = (members.data ?? []).filter((member) => !punchedIds.has(member.id))

  return (
    <div className="space-y-3">
      <h2 className="font-semibold">
        Today’s punch-ins ({punched.length}/{members.data?.length ?? '…'})
      </h2>
      {punched.length === 0 ? (
        <p className="text-slate-600">Nobody has punched in yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {punched.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
            >
              <span className="font-medium">{row.member?.display_name}</span>
              <span className="flex items-center gap-3 text-sm text-slate-600">
                {formatNepalTime(new Date(row.punched_in_at))}
                <span>{evidenceText(row)}</span>
                <AttendanceStatusBadge status={row.status} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {notYet.length > 0 && (
        <p className="text-sm text-slate-600">
          Not punched in yet: {notYet.map((member) => member.display_name).join(', ')}
        </p>
      )}
    </div>
  )
}
