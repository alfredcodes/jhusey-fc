import { useState, type FormEvent } from 'react'
import { errorMessage } from '../../lib/errors.ts'
import { Link } from 'react-router'
import {
  FormError,
  FormSuccess,
  inputClass,
  primaryButtonClass,
  smallButtonClass,
} from '../../components/form.tsx'
import { addDays, formatCalendarDate, nepalToday } from '../../lib/nepal-time.ts'
import {
  useCreateSessions,
  useDeleteSession,
  useUpcomingSessions,
  useUpdateSession,
  useVenues,
  type SessionRow,
} from './queries.ts'
import SessionStatusBadge from './SessionStatusBadge.tsx'

// PostgreSQL and JavaScript both number weekdays 0 = Sunday ... 6 = Saturday.
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export default function AdminSessionsPage() {
  return (
    <section className="space-y-8">
      <h1 className="text-2xl font-semibold">Sessions</h1>
      <SessionGenerator />
      <UpcomingSessions />
    </section>
  )
}

function SessionGenerator() {
  const venues = useVenues()
  const create = useCreateSessions()
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const activeVenues = venues.data?.filter((venue) => venue.is_active) ?? []
  const today = nepalToday()

  if (venues.isSuccess && activeVenues.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-300 p-4 text-slate-600">
        Add a venue before creating sessions.{' '}
        <Link to="/admin/venues" className="font-medium text-emerald-800 underline">
          Go to venues
        </Link>
      </p>
    )
  }

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
          ? 'No new sessions: every matching date already had one.'
          : `Created ${created} session${created === 1 ? '' : 's'}. Dates that already had a session were skipped.`,
      )
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      <h2 className="font-semibold">Create sessions</h2>
      <label className="block text-sm font-medium">
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
        <label className="block text-sm font-medium">
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
        <label className="block text-sm font-medium">
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
        <legend className="text-sm font-medium">Weekdays</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEKDAYS.map((label, day) => {
            const checked = weekdays.includes(day)
            return (
              <label
                key={label}
                className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium ${
                  checked
                    ? 'border-emerald-800 bg-emerald-800 text-white'
                    : 'border-slate-300 bg-white'
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
      <p className="text-sm text-slate-600">
        Every session uses the fixed punch-in deadline of 7:15 PM Nepal time.
      </p>
      <FormError message={error} />
      <FormSuccess message={result} />
      <button type="submit" disabled={create.isPending} className={primaryButtonClass}>
        {create.isPending ? 'Creating…' : 'Create sessions'}
      </button>
    </form>
  )
}

function UpcomingSessions() {
  const sessions = useUpcomingSessions()

  return (
    <div className="space-y-3">
      <h2 className="font-semibold">Upcoming</h2>
      {sessions.isPending && <p className="text-slate-600">Loading sessions…</p>}
      {sessions.isError && <FormError message={errorMessage(sessions.error)} />}
      {sessions.data?.length === 0 && <p className="text-slate-600">No upcoming sessions.</p>}
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {sessions.data?.map((session) => (
          <SessionItem key={session.id} session={session} />
        ))}
      </ul>
    </div>
  )
}

function SessionItem({ session }: { session: SessionRow }) {
  const update = useUpdateSession()
  const remove = useDeleteSession()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = update.isPending || remove.isPending
  const cancelled = session.status === 'cancelled'

  async function run(action: () => Promise<unknown>) {
    setError(null)
    try {
      await action()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div>
        <p className={`font-medium ${cancelled ? 'text-slate-500 line-through' : ''}`}>
          {formatCalendarDate(session.session_date)}
        </p>
        <p className="text-sm text-slate-600">
          {session.venue?.name} <SessionStatusBadge status={session.status} />
        </p>
        <FormError message={error} />
      </div>
      <div className="flex gap-2">
        {confirmDelete ? (
          <>
            <button
              type="button"
              disabled={busy}
              className={`${smallButtonClass} border-red-300 text-red-800`}
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
        )}
      </div>
    </li>
  )
}
