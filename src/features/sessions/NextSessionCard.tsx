import { Link } from 'react-router'
import { FormError } from '../../components/form.tsx'
import { Icon } from '../../components/icons.tsx'
import { Badge, Card, CardHeader, LoadingRows } from '../../components/ui.tsx'
import { errorMessage } from '../../lib/errors.ts'
import { formatCalendarDate, nepalToday } from '../../lib/nepal-time.ts'
import { timeLabel, useClubRules } from '../team/queries.ts'
import { useUpcomingSessions } from './queries.ts'
import { CantComeButton } from './SessionsPage.tsx'

/** The next sessions, with the member's own "can't come" action. */
export default function NextSessionCard() {
  const sessions = useUpcomingSessions(10)
  const { data: rules } = useClubRules()

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader
        title="Upcoming sessions"
        description={rules && `On time until ${timeLabel(rules.on_time_cutoff)} Nepal time`}
        actions={
          <Link
            to="/sessions"
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            All sessions <Icon name="chevronRight" className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <div className="mt-4">
        {sessions.isPending && <LoadingRows rows={3} />}
        {sessions.isError && <FormError message={errorMessage(sessions.error)} />}
        {sessions.data?.length === 0 && (
          <p className="text-sm text-gray-500">No sessions scheduled yet.</p>
        )}
        <ul className="divide-y divide-gray-50">
          {sessions.data?.slice(0, 5).map((session) => {
            const cancelled = session.status === 'cancelled'
            return (
              <li
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Icon name="calendar" className="h-4 w-4" />
                  </span>
                  <div>
                    <p
                      className={`text-sm font-semibold ${cancelled ? 'text-gray-400 line-through' : 'text-gray-900'}`}
                    >
                      {formatCalendarDate(session.session_date)}
                    </p>
                    <p className="text-xs text-gray-400">{session.venue?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {session.session_date === nepalToday() && !cancelled && (
                    <Badge tone="blue">Today</Badge>
                  )}
                  {cancelled ? (
                    <Badge tone="gray">Cancelled</Badge>
                  ) : (
                    <CantComeButton session={session} />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </Card>
  )
}
