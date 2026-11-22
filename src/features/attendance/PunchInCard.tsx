import { useState } from 'react'
import { FormError, primaryButtonClass } from '../../components/form.tsx'
import { errorMessage } from '../../lib/errors.ts'
import { getCurrentPosition, LocationError } from '../../lib/geolocation.ts'
import { formatNepalTime } from '../../lib/nepal-time.ts'
import AttendanceStatusBadge from './AttendanceStatusBadge.tsx'
import { useMyAttendance, usePunchIn } from './queries.ts'

type Step = 'idle' | 'locating' | 'sending'

/** Today's punch-in. Shown on the member dashboard only when today has a scheduled session. */
export default function PunchInCard({
  sessionId,
  venueName,
}: {
  sessionId: string
  venueName: string
}) {
  const mine = useMyAttendance(sessionId)
  const punchIn = usePunchIn()
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
    return <div className="rounded-lg border border-slate-200 bg-white p-4">Checking today…</div>
  }

  const record = mine.data
  if (record) {
    return (
      <div className="rounded-lg border border-emerald-300 bg-white p-4 shadow-sm" role="status">
        <p className="text-sm font-medium text-emerald-800">You’re punched in</p>
        <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
          {formatNepalTime(new Date(record.punched_in_at))}
          <AttendanceStatusBadge status={record.status} />
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {Math.round(record.distance_m)} m from {venueName} · GPS ±{Math.round(record.accuracy_m)}{' '}
          m
        </p>
        {record.fine && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Late fine: <strong>NPR {record.fine.amount_npr}</strong> ({record.fine.status})
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border-2 border-emerald-700 bg-white p-4 shadow-sm">
      <div>
        <p className="font-semibold">Punch in at {venueName}</p>
        <p className="text-sm text-slate-600">
          On time until <strong>7:15:00 PM</strong>. Punch-in is open 6:30 PM – 9:00 PM.
        </p>
      </div>
      <button
        type="button"
        onClick={handlePunchIn}
        disabled={step !== 'idle'}
        className={`${primaryButtonClass} py-4 text-lg`}
      >
        {step === 'locating'
          ? 'Finding your location…'
          : step === 'sending'
            ? 'Punching in…'
            : 'Punch In'}
      </button>
      <p className="text-xs text-slate-500">
        Your location is read once, when you tap the button. The official time comes from the
        server, not your phone.
      </p>
      <FormError message={error} />
    </div>
  )
}
