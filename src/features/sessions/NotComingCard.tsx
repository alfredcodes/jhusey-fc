import { FormError } from '../../components/form.tsx'
import { Icon } from '../../components/icons.tsx'
import { Avatar, Badge, Card, CardHeader, LoadingRows } from '../../components/ui.tsx'
import { errorMessage } from '../../lib/errors.ts'
import { absenceNoticeOpen, addDays, formatCalendarDate, nepalToday } from '../../lib/nepal-time.ts'
import { useAbsenceNotices, useUpcomingSessions } from './queries.ts'

/**
 * "Not coming to the next game": everyone who told the team they cannot come (or was
 * excused by the admin) for the next scheduled game, so the team knows before game day.
 */
export default function NotComingCard() {
  const sessions = useUpcomingSessions(10)
  const next = sessions.data?.find((session) => session.status === 'scheduled')
  const notices = useAbsenceNotices(next ? [next.id] : [])
  const today = nepalToday()
  const when =
    next?.session_date === today
      ? 'Today'
      : next?.session_date === addDays(today, 1)
        ? 'Tomorrow'
        : null

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Icon name="userX" className="h-5 w-5 text-rose-500" /> Not coming to the next game
          </span>
        }
        description={
          next
            ? `${when ? `${when} · ` : ''}${formatCalendarDate(next.session_date)}${next.venue ? ` · ${next.venue.name}` : ''}`
            : undefined
        }
        actions={
          next &&
          notices.data && (
            <Badge tone={notices.data.length ? 'red' : 'green'}>
              {notices.data.length} not coming
            </Badge>
          )
        }
      />
      <div className="mt-4">
        {(sessions.isPending || (next && notices.isPending)) && <LoadingRows rows={2} />}
        {sessions.isError && <FormError message={errorMessage(sessions.error)} />}
        {notices.isError && <FormError message={errorMessage(notices.error)} />}
        {sessions.data && !next && <p className="text-sm text-gray-500">No game scheduled yet.</p>}
        {next && notices.data?.length === 0 && (
          <p className="text-sm text-gray-500">
            Nobody has said they can’t come. Full squad so far.
          </p>
        )}
        {notices.data && notices.data.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {notices.data.map((notice) => (
              <li
                key={notice.id}
                className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/60 py-1.5 pr-3 pl-1.5"
              >
                <Avatar name={notice.member?.display_name ?? '?'} size="sm" />
                <span className="text-sm font-semibold text-gray-900">
                  {notice.member?.display_name}
                </span>
                {notice.source === 'admin' && <Badge tone="purple">Excused by admin</Badge>}
              </li>
            ))}
          </ul>
        )}
        {next && (
          <p className="mt-4 text-xs text-gray-400">
            {absenceNoticeOpen(next.session_date)
              ? `Can’t come? Tell the team before 9 PM on ${formatCalendarDate(addDays(next.session_date, -1))}.`
              : 'Notices for this game are closed. Contact the admin if something came up.'}
          </p>
        )}
      </div>
    </Card>
  )
}
