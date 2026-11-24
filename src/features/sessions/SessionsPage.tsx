import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import {
  FormError,
  FormSuccess,
  inputClass,
  labelClass,
  linkButtonClass,
  primaryAutoButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
} from '../../components/form.tsx'
import { Icon } from '../../components/icons.tsx'
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  LoadingRows,
  Modal,
  PageHeader,
  Td,
  Th,
  TableFrame,
} from '../../components/ui.tsx'
import { formatNpr } from '../../lib/format.ts'
import { errorMessage } from '../../lib/errors.ts'
import { absenceNoticeOpen, addDays, formatCalendarDate, nepalToday } from '../../lib/nepal-time.ts'
import {
  currentMonth,
  monthLabel,
  timeLabel,
  useClubRules,
  useIsAdmin,
  useMyExcuses,
  useNotifyAbsence,
} from '../team/queries.ts'
import NotComingCard from './NotComingCard.tsx'
import {
  useAbsenceNotices,
  useCreateSessions,
  useDeleteSession,
  useSessionsInMonth,
  useUpdateSession,
  useVenues,
  type AbsenceNotice,
  type SessionRow,
} from './queries.ts'

// PostgreSQL and JavaScript both number weekdays 0 = Sunday ... 6 = Saturday.
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** Futsal games (sessions) month by month, with who is not coming to each one. */
export default function SessionsPage() {
  const isAdmin = useIsAdmin()
  const [month, setMonth] = useState(currentMonth())
  const sessions = useSessionsInMonth(month)
  const notices = useAbsenceNotices(sessions.data?.map((session) => session.id) ?? [])
  const { data: rules } = useClubRules()
  const [creating, setCreating] = useState(false)
  const today = nepalToday()
  const scheduled = sessions.data?.filter((session) => session.status === 'scheduled') ?? []
  const upcoming = scheduled.filter((session) => session.session_date >= today).length
  const byGame = new Map<string, AbsenceNotice[]>()
  for (const notice of notices.data ?? []) {
    byGame.set(notice.session_id, [...(byGame.get(notice.session_id) ?? []), notice])
  }

  return (
    <>
      <PageHeader
        title="Futsal Games"
        badges={
          <>
            <Badge tone="blue">{monthLabel(month)}</Badge>
            <Badge tone="green">{upcoming} upcoming</Badge>
          </>
        }
        description={
          rules ? (
            <span className="block truncate text-xs">
              Punch in {timeLabel(rules.punch_open)} – {timeLabel(rules.punch_close)} · on time by{' '}
              {timeLabel(rules.on_time_cutoff)} · notice by 9 PM the day before
            </span>
          ) : undefined
        }
        actions={
          isAdmin && (
            <button
              type="button"
              className={primaryAutoButtonClass}
              onClick={() => setCreating(true)}
            >
              <Icon name="plus" className="h-4 w-4" /> Create games
            </button>
          )
        }
      />

      <NotComingCard />

      <Card>
        <div className="border-b border-gray-100 p-5">
          <CardHeader
            title={`Games in ${monthLabel(month)}`}
            description={
              isAdmin
                ? `${scheduled.length} scheduled`
                : `${scheduled.length} scheduled${rules ? ` · ${formatNpr(rules.absence_fine_npr)} if absent without notice` : ''}`
            }
            actions={
              <label className="block">
                <span className="sr-only">Month</span>
                <input
                  type="month"
                  value={month}
                  onChange={(event) => event.target.value && setMonth(event.target.value)}
                  className="block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </label>
            }
          />
        </div>
        {sessions.isPending && <LoadingRows />}
        {sessions.isError && (
          <div className="p-5">
            <FormError message={errorMessage(sessions.error)} />
          </div>
        )}
        {sessions.data?.length === 0 && (
          <EmptyState icon="calendar" title={`No games in ${monthLabel(month)}`}>
            {isAdmin ? 'Create games for the coming weeks.' : 'The admin has not scheduled any.'}
          </EmptyState>
        )}
        {sessions.data && sessions.data.length > 0 && (
          <TableFrame caption={`Games in ${monthLabel(month)}`}>
            <thead className="border-b border-gray-100 bg-gray-50/60">
              <tr>
                <Th>Date</Th>
                <Th className="hidden sm:table-cell">Venue</Th>
                <Th>Status</Th>
                <Th>Not coming</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sessions.data.map((session) => (
                <SessionRowItem
                  key={session.id}
                  session={session}
                  isAdmin={isAdmin}
                  notComing={byGame.get(session.id) ?? []}
                />
              ))}
            </tbody>
          </TableFrame>
        )}
      </Card>

      {creating && <CreateSessionsModal onClose={() => setCreating(false)} />}
    </>
  )
}

function SessionRowItem({
  session,
  isAdmin,
  notComing,
}: {
  session: SessionRow
  isAdmin: boolean
  notComing: AbsenceNotice[]
}) {
  const update = useUpdateSession()
  const remove = useDeleteSession()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = update.isPending || remove.isPending
  const cancelled = session.status === 'cancelled'
  const isToday = session.session_date === nepalToday()
  const isPast = session.session_date < nepalToday()

  async function run(action: () => Promise<unknown>) {
    setError(null)
    try {
      await action()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <tr className="transition-colors hover:bg-gray-50/60">
      <Td>
        <p
          className={`font-semibold text-gray-900 ${cancelled ? 'text-gray-400 line-through' : ''}`}
        >
          {formatCalendarDate(session.session_date)}
        </p>
        {isToday && <p className="text-xs font-medium text-blue-600">Today</p>}
        <p className="text-xs text-gray-400 sm:hidden">{session.venue?.name}</p>
        <FormError message={error} />
      </Td>
      <Td className="hidden text-gray-600 sm:table-cell">{session.venue?.name}</Td>
      <Td>
        {cancelled ? (
          <Badge tone="gray" dot>
            Cancelled
          </Badge>
        ) : (
          <Badge tone="green" dot>
            Scheduled
          </Badge>
        )}
      </Td>
      <Td label="Not coming">
        {notComing.length === 0 ? (
          <span className="text-xs text-gray-300">—</span>
        ) : (
          <div className="flex max-w-64 flex-wrap gap-1">
            {notComing.map((notice) => (
              <Badge key={notice.id} tone={notice.source === 'admin' ? 'purple' : 'red'}>
                {notice.member?.display_name}
              </Badge>
            ))}
          </div>
        )}
      </Td>
      <Td align="right">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {!cancelled && <CantComeButton session={session} />}
          {isAdmin &&
            !isPast &&
            (confirmDelete ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  className={`${smallButtonClass} border-rose-200 text-rose-600`}
                  onClick={() => run(() => remove.mutateAsync(session.id))}
                >
                  Confirm delete
                </button>
                <button
                  type="button"
                  className={smallButtonClass}
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  className={smallButtonClass}
                  onClick={() =>
                    run(() =>
                      update.mutateAsync({
                        id: session.id,
                        status: cancelled ? 'scheduled' : 'cancelled',
                      }),
                    )
                  }
                >
                  {cancelled ? 'Restore' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className={smallButtonClass}
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </button>
              </>
            ))}
        </div>
      </Td>
    </tr>
  )
}

/**
 * "I can't come" for a future game (deadline: 9 PM Nepal time the day before the game),
 * or "I can come after all" to withdraw it. The database enforces the deadline.
 */
export function CantComeButton({ session }: { session: Pick<SessionRow, 'id' | 'session_date'> }) {
  const excuses = useMyExcuses()
  const notify = useNotifyAbsence()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mine = excuses.data?.find((excuse) => excuse.session_id === session.id)
  const beforeDeadline = absenceNoticeOpen(session.session_date)

  if (mine) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Badge tone="purple">
          {mine.source === 'admin' ? 'Excused by admin' : "You can't come"}
        </Badge>
        {mine.source === 'member' && beforeDeadline && (
          <button
            type="button"
            className={linkButtonClass}
            disabled={notify.isPending}
            onClick={() =>
              notify.mutate(
                { sessionId: session.id, note: '', withdraw: true },
                { onError: (caught) => setError(errorMessage(caught)) },
              )
            }
          >
            I can come
          </button>
        )}
        {error && <span className="text-xs text-rose-600">{error}</span>}
      </span>
    )
  }
  if (!beforeDeadline) return null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError(null)
    try {
      await notify.mutateAsync({ sessionId: session.id, note: String(form.get('note')) })
      setOpen(false)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <>
      <button type="button" className={smallButtonClass} onClick={() => setOpen(true)}>
        Can’t come
      </button>
      {open && (
        <Modal
          title="Tell the team you can’t come"
          description={`${formatCalendarDate(session.session_date)}. Telling the team before 9 PM on ${formatCalendarDate(addDays(session.session_date, -1))} means no absence fine.`}
          onClose={() => setOpen(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className={labelClass}>
              Note (optional, only you and the admin see it)
              <input
                name="note"
                maxLength={300}
                className={inputClass}
                placeholder="e.g. Work trip"
              />
            </label>
            <FormError message={error} />
            <div className="flex gap-2">
              <button type="submit" disabled={notify.isPending} className={primaryButtonClass}>
                {notify.isPending ? 'Sending…' : 'Send notice'}
              </button>
              <button type="button" className={secondaryButtonClass} onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

function CreateSessionsModal({ onClose }: { onClose: () => void }) {
  const venues = useVenues()
  const create = useCreateSessions()
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const activeVenues = venues.data?.filter((venue) => venue.is_active) ?? []
  const today = nepalToday()

  function toggleWeekday(day: number) {
    setWeekdays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort(),
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setResult(null)
    if (weekdays.length === 0) {
      setError('Choose at least one weekday.')
      return
    }
    setError(null)
    try {
      const created = await create.mutateAsync({
        venueId: String(form.get('venue')),
        from: String(form.get('from')),
        to: String(form.get('to')),
        weekdays,
      })
      setResult(
        created === 0
          ? 'No new games: every matching date already had one.'
          : `Created ${created} game${created === 1 ? '' : 's'}. Dates that already had a game were skipped.`,
      )
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <Modal title="Create games" description="Repeat on chosen weekdays." onClose={onClose}>
      {venues.isSuccess && activeVenues.length === 0 ? (
        <p className="text-sm text-gray-600">
          Add a venue first in{' '}
          <Link to="/settings?tab=futsal" className="font-semibold text-blue-600 underline">
            Settings → Futsal
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className={labelClass}>
            Venue
            <select name="venue" required className={inputClass}>
              {activeVenues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              From
              <input
                name="from"
                type="date"
                required
                min={today}
                defaultValue={today}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              To
              <input
                name="to"
                type="date"
                required
                min={today}
                defaultValue={addDays(today, 55)}
                className={inputClass}
              />
            </label>
          </div>
          <fieldset>
            <legend className={labelClass}>Weekdays</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAYS.map((label, day) => {
                const checked = weekdays.includes(day)
                return (
                  <label
                    key={label}
                    className={`cursor-pointer rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors ${
                      checked
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggleWeekday(day)}
                    />
                    {label}
                  </label>
                )
              })}
            </div>
          </fieldset>
          <FormError message={error} />
          <FormSuccess message={result} />
          <button type="submit" disabled={create.isPending} className={primaryButtonClass}>
            {create.isPending ? 'Creating…' : 'Create games'}
          </button>
        </form>
      )}
    </Modal>
  )
}
