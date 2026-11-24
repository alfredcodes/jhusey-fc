import { FormError } from '../../components/form.tsx'
import {
  Card,
  EmptyState,
  LoadingRows,
  PageHeader,
  Td,
  Th,
  TableFrame,
} from '../../components/ui.tsx'
import { osmLink } from '../../lib/coordinates.ts'
import { errorMessage } from '../../lib/errors.ts'
import { formatCalendarDate, formatNepalTime } from '../../lib/nepal-time.ts'
import { FineBadge, ResultBadge } from '../attendance/ResultBadge.tsx'
import MemberStats from './MemberStats.tsx'
import { useMyHistory } from './queries.ts'

/** The member's own complete history, including their GPS evidence (private to them). */
export default function HistoryPage() {
  const history = useMyHistory()

  return (
    <>
      <PageHeader
        title="My Record"
        description="Every session since you joined, with your punch-in evidence. Only you and the admin see your exact location."
      />
      <MemberStats />

      <Card>
        {history.isPending && <LoadingRows />}
        {history.isError && (
          <div className="p-5">
            <FormError message={errorMessage(history.error)} />
          </div>
        )}
        {history.data?.length === 0 && (
          <EmptyState icon="history" title="No sessions yet since you joined" />
        )}
        {history.data && history.data.length > 0 && (
          <TableFrame caption="My session history">
            <thead className="border-b border-gray-100 bg-gray-50/60">
              <tr>
                <Th>Session</Th>
                <Th>Result</Th>
                <Th className="hidden md:table-cell">Evidence</Th>
                <Th>Fine</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {history.data.map((row) => (
                <tr key={row.session_id} className="align-top">
                  <Td>
                    <p className="font-semibold text-gray-900">
                      {formatCalendarDate(row.session_date)}
                    </p>
                    <p className="text-[11px] text-gray-400">{row.venue_name}</p>
                  </Td>
                  <Td>
                    <ResultBadge result={row.result} />
                    {row.punched_in_at && (
                      <p className="mt-1 font-mono text-xs text-gray-600">
                        {row.source === 'admin' ? 'Arrived ' : ''}
                        {formatNepalTime(new Date(row.punched_in_at))}
                      </p>
                    )}
                    {row.original_status && row.original_status !== row.result && (
                      <p className="mt-1 text-[11px] text-gray-400">
                        Corrected by the admin (originally{' '}
                        {row.original_status === 'late' ? 'Late' : 'On time'})
                      </p>
                    )}
                    {row.source === 'admin' && (
                      <p className="mt-1 text-[11px] text-gray-400">
                        Recorded by the admin (no GPS)
                      </p>
                    )}
                  </Td>
                  <Td label="Evidence" className="hidden md:table-cell">
                    {row.distance_m !== null && row.accuracy_m !== null ? (
                      <div className="text-xs text-gray-600">
                        <p>
                          {Math.round(row.distance_m)} m from venue · GPS ±
                          {Math.round(row.accuracy_m)} m
                        </p>
                        {row.latitude !== null && row.longitude !== null && (
                          <a
                            href={osmLink({ latitude: row.latitude, longitude: row.longitude })}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-blue-600 hover:underline"
                            aria-label={`Map of punch-in location: ${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)}`}
                          >
                            View map
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </Td>
                  <Td label="Fine">
                    <FineBadge
                      reason={row.fine_reason}
                      amount={row.fine_npr}
                      status={row.fine_status}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </Card>
    </>
  )
}
