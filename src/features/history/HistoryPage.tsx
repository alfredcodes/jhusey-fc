import { FormError } from '../../components/form.tsx'
import { osmLink } from '../../lib/coordinates.ts'
import { errorMessage } from '../../lib/errors.ts'
import { formatCalendarDate, formatNepalTime } from '../../lib/nepal-time.ts'
import MemberStats from './MemberStats.tsx'
import { useMyHistory } from './queries.ts'
import type { HistoryRow } from './summary.ts'

const resultLabel: Record<HistoryRow['result'], { text: string; className: string }> = {
  on_time: { text: 'On time', className: 'bg-emerald-100 text-emerald-900' },
  late: { text: 'Late', className: 'bg-amber-100 text-amber-900' },
  absent: { text: 'Absent', className: 'bg-slate-200 text-slate-800' },
  open: { text: 'Not yet', className: 'bg-sky-100 text-sky-900' },
}

export default function HistoryPage() {
  const history = useMyHistory()

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">My attendance</h1>
      <MemberStats />

      {history.isPending && <p className="text-slate-600">Loading history…</p>}
      {history.isError && <FormError message={errorMessage(history.error)} />}
      {history.data?.length === 0 && (
        <p className="text-slate-600">No sessions yet since you joined.</p>
      )}

      <ul className="space-y-3">
        {history.data?.map((row) => {
          const label = resultLabel[row.result]
          return (
            <li key={row.session_id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{formatCalendarDate(row.session_date)}</p>
                <span className={`rounded px-2 py-0.5 text-sm font-semibold ${label.className}`}>
                  {label.text}
                </span>
              </div>
              <p className="text-sm text-slate-600">{row.venue_name}</p>
              {row.original_status && row.original_status !== row.result && (
                <p className="text-sm text-slate-600">
                  Corrected by the admin (originally{' '}
                  {row.original_status === 'late' ? 'Late' : 'On time'})
                </p>
              )}
              {row.source === 'admin' && (
                <p className="text-sm text-slate-600">Recorded by the admin (no GPS)</p>
              )}

              {row.punched_in_at && (
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-slate-500">
                      {row.source === 'admin' ? 'Arrived' : 'Punched in'}
                    </dt>
                    <dd className="font-mono">{formatNepalTime(new Date(row.punched_in_at))}</dd>
                  </div>
                  {row.distance_m !== null && (
                    <div>
                      <dt className="text-slate-500">Distance</dt>
                      <dd>{Math.round(row.distance_m)} m</dd>
                    </div>
                  )}
                  {row.accuracy_m !== null && (
                    <div>
                      <dt className="text-slate-500">GPS accuracy</dt>
                      <dd>±{Math.round(row.accuracy_m)} m</dd>
                    </div>
                  )}
                  {row.latitude !== null && row.longitude !== null && (
                    <div>
                      <dt className="text-slate-500">Location</dt>
                      <dd>
                        <a
                          href={osmLink({ latitude: row.latitude, longitude: row.longitude })}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-800 underline"
                          aria-label={`Map of punch-in location: ${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)}`}
                        >
                          View map
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              )}

              {row.fine_npr !== null && (
                <p className="mt-2 text-sm text-amber-900">
                  Late fine NPR {row.fine_npr} · {row.fine_status}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
