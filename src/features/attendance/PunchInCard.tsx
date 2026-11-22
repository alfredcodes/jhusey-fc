import { useState } from 'react'
import { FormError, primaryButtonClass } from '../../components/form.tsx'
import { Icon } from '../../components/icons.tsx'
import { Card } from '../../components/ui.tsx'
import { formatNpr } from '../../lib/format.ts'
import { errorMessage } from '../../lib/errors.ts'
import { getCurrentPosition, LocationError } from '../../lib/geolocation.ts'
import { formatNepalTime } from '../../lib/nepal-time.ts'
import { timeLabel, useClubRules } from '../team/queries.ts'
import { evidenceText } from './evidence.ts'
import { useMyAttendance, usePunchIn } from './queries.ts'
import { ResultBadge } from './ResultBadge.tsx'

type Step = 'idle' | 'locating' | 'sending'

/** Today's punch-in. Shown on the dashboard when today has a scheduled session. */
export default function PunchInCard({
  sessionId,
  venueName,
}: {
  sessionId: string
  venueName: string
}) {
  const mine = useMyAttendance(sessionId)
  const punchIn = usePunchIn()
  const { data: rules } = useClubRules()
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handlePunchIn() {
    setError(null)
    try {
      setStep('locating')
      const position = await getCurrentPosition()
      setStep('sending')
      await punchIn.mutateAsync(position)
    } catch (caught) {
      // Location errors are already written for the member; server errors go through errorMessage.
      setError(caught instanceof LocationError ? caught.message : errorMessage(caught))
    } finally {
      setStep('idle')
    }
  }

  if (mine.isPending) {
    return <Card className="p-5 text-sm text-gray-500">Checking today…</Card>
  }

  const record = mine.data
  if (record) {
    return (
      <Card className="border-emerald-100 p-5" as="section">
        <div role="status" className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Icon name="checkCircle" className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-wide text-emerald-700 uppercase">
                You’re punched in
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 tabular-nums">
                {formatNepalTime(new Date(record.punched_in_at))}
                <ResultBadge result={record.status} />
              </p>
              <p className="text-xs text-gray-500">
                {venueName} · {evidenceText(record)}
              </p>
            </div>
          </div>
          {record.fine && (
            <p className="rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-2 text-sm text-amber-800">
              Late fine: <strong>{formatNpr(record.fine.amount_npr)}</strong> ({record.fine.status})
            </p>
          )}
        </div>
      </Card>
    )
  }

  return (
    <Card className="border-blue-100 p-5 sm:p-6" as="section">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Icon name="pin" className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-base font-bold text-gray-900">Punch in at {venueName}</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              On time until{' '}
              <strong className="text-gray-800">{timeLabel(rules?.on_time_cutoff)}</strong>.
              Punch-in is open {timeLabel(rules?.punch_open)} – {timeLabel(rules?.punch_close)}.
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Your location is read once, when you tap the button. The official time comes from the
              server, not your phone.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handlePunchIn}
          disabled={step !== 'idle'}
          className={`${primaryButtonClass} py-4 text-base sm:w-56`}
        >
          <Icon name="pin" />
          {step === 'locating'
            ? 'Finding your location…'
            : step === 'sending'
              ? 'Punching in…'
              : 'Punch In'}
        </button>
      </div>
      <div className="mt-4">
        <FormError message={error} />
      </div>
    </Card>
  )
}
