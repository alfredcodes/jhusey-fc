import { useState } from 'react'
import { FormError, inputClass, smallButtonClass } from '../../components/form.tsx'
import ReasonPrompt from '../../components/ReasonPrompt.tsx'
import { errorMessage } from '../../lib/errors.ts'
import { formatCalendarDate, formatNepalTime, nepalToday } from '../../lib/nepal-time.ts'
import AttendanceStatusBadge from '../attendance/AttendanceStatusBadge.tsx'
import { evidenceText } from '../attendance/evidence.ts'
import { useRecentSessions } from '../history/queries.ts'
import {
  useCorrectAttendance,
  useRecordAttendance,
  useSessionRoster,
  type RosterEntry,
} from './queries.ts'

export default function AdminAttendancePage() {
  const sessions = useRecentSessions()
  const [chosen, setChosen] = useState<string | null>(null)
  const session = sessions.data?.find((s) => s.id === chosen) ?? sessions.data?.[0]
  const roster = useSessionRoster(session?.id)

  const punched = roster.data?.filter((entry) => entry.record).length ?? 0

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Attendance</h1>
      <p className="text-sm text-slate-600">
        Corrections change only the current status. The original punch-in time, GPS and result are
        kept, and every change is saved in the audit log.
      </p>

      {sessions.isError && <FormError message={errorMessage(sessions.error)} />}
      {sessions.data?.length === 0 && <p className="text-slate-600">No sessions yet.</p>}
      {sessions.data && session && (
        <label className="block text-sm font-medium">
          Session
          <select
            className={inputClass}
            value={session.id}
            onChange={(event) => setChosen(event.target.value)}
          >
            {sessions.data.map((s) => (
              <option key={s.id} value={s.id}>
                {formatCalendarDate(s.session_date)}
              </option>
            ))}
          </select>
        </label>
      )}

      {roster.isError && <FormError message={errorMessage(roster.error)} />}
      {roster.data && session && (
        <>
          <p className="text-sm text-slate-600">
            {punched} of {roster.data.length} have attendance
          </p>
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {roster.data.map((entry) => (
              <RosterItem
                key={entry.member.id}
                entry={entry}
                sessionId={session.id}
                isPast={session.session_date < nepalToday()}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function RosterItem({
  entry,
  sessionId,
  isPast,
}: {
  entry: RosterEntry
  sessionId: string
  isPast: boolean
}) {
  const correct = useCorrectAttendance()
  const record = useRecordAttendance()
  const [open, setOpen] = useState<'correct' | 'record' | null>(null)
  const [arrivedAt, setArrivedAt] = useState('19:00')
  const { member, record: row } = entry

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{member.display_name}</p>
          {row ? (
            <p className="text-sm text-slate-600">
              {formatNepalTime(new Date(row.punched_in_at))} · {evidenceText(row)}
              {row.original_status !== row.status && (
                <> · corrected (was {row.original_status === 'late' ? 'Late' : 'On time'})</>
              )}
              {row.fine && (
                <>
                  {' '}
                  · fine NPR {row.fine.amount_npr} {row.fine.status}
                </>
              )}
            </p>
          ) : (
            <p className="text-sm text-slate-600">{isPast ? 'Absent' : 'Not punched in yet'}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {row && <AttendanceStatusBadge status={row.status} />}
          {open === null && (
            <button
              type="button"
              className={smallButtonClass}
              onClick={() => setOpen(row ? 'correct' : 'record')}
            >
              {row
                ? `Change to ${row.status === 'late' ? 'On time' : 'Late'}`
                : 'Record attendance'}
            </button>
          )}
        </div>
      </div>

      {open === 'correct' && row && (
        <ReasonPrompt
          title={`Change ${member.display_name} to ${row.status === 'late' ? 'On time (the pending fine will be waived)' : 'Late (an NPR 50 fine will be added)'}`}
          confirmLabel="Save correction"
          onCancel={() => setOpen(null)}
          onConfirm={async (reason) => {
            await correct.mutateAsync({
              attendanceId: row.id,
              status: row.status === 'late' ? 'on_time' : 'late',
              reason,
            })
            setOpen(null)
          }}
        />
      )}

      {open === 'record' && (
        <ReasonPrompt
          title={`Record attendance for ${member.display_name} (no GPS)`}
          confirmLabel="Record attendance"
          onCancel={() => setOpen(null)}
          onConfirm={async (reason) => {
            await record.mutateAsync({ memberId: member.id, sessionId, arrivedAt, reason })
            setOpen(null)
          }}
        >
          <label className="block text-sm font-medium">
            Arrival time (Nepal)
            <input
              type="time"
              required
              value={arrivedAt}
              onChange={(event) => setArrivedAt(event.target.value)}
              className={inputClass}
            />
          </label>
          <p className="text-xs text-slate-600">
            After 7:15 PM counts as Late and adds the NPR 50 fine.
          </p>
        </ReasonPrompt>
      )}
    </li>
  )
}
