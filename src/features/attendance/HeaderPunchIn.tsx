import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/icons.tsx'
import { formatNpr } from '../../lib/format.ts'
import { errorMessage } from '../../lib/errors.ts'
import { getCurrentPosition, LocationError } from '../../lib/geolocation.ts'
import { formatNepalTime, nepalToday } from '../../lib/nepal-time.ts'
import { useUpcomingSessions } from '../sessions/queries.ts'
import { timeLabel, useClubRules } from '../team/queries.ts'
import { evidenceText } from './evidence.ts'
import { useMyAttendance, usePunchIn } from './queries.ts'
import { ResultBadge } from './ResultBadge.tsx'

type Step = 'idle' | 'locating' | 'sending'

const popoverBase =
  'absolute z-40 rounded-2xl border border-gray-100 bg-white p-4 text-sm shadow-lg'
const popoverClass = {
  header: `${popoverBase} right-0 mt-2 w-72 max-w-[calc(100vw-2rem)]`,
  // The bar sits at the bottom of the screen, so its popover opens upwards.
  bar: `${popoverBase} inset-x-0 bottom-full mb-2`,
}

type Variant = 'header' | 'bar'

function useTodaySession() {
  const sessions = useUpcomingSessions(10)
  const today = nepalToday()
  return sessions.data?.find((row) => row.session_date === today && row.status === 'scheduled')
}

/**
 * Punch In button in the header. Shown only on a day with a scheduled session.
 * Below xl the header shows only the "Punched In" chip; the button itself lives in
 * MobilePunchInBar, within thumb reach above the tab bar.
 */
export default function HeaderPunchIn() {
  const session = useTodaySession()
  if (!session) return null
  return <PunchInControl sessionId={session.id} venueName={session.venue?.name ?? 'the venue'} />
}

/** Phone/tablet: a floating punch-in bar above the tab bar on a game day, until punched in. */
export function MobilePunchInBar() {
  const session = useTodaySession()
  if (!session) return null
  return (
    <PunchInControl
      sessionId={session.id}
      venueName={session.venue?.name ?? 'the venue'}
      variant="bar"
    />
  )
}

export function PunchInControl({
  sessionId,
  venueName,
  variant = 'header',
}: {
  sessionId: string
  venueName: string
  variant?: Variant
}) {
  const mine = useMyAttendance(sessionId)
  const punchIn = usePunchIn()
  const { data: rules } = useClubRules()
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const showPopover = open || error !== null
  useEffect(() => {
    if (!showPopover) return
    function onClick(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false)
        setError(null)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showPopover])

  async function handlePunchIn() {
    setError(null)
    try {
      setStep('locating')
      const position = await getCurrentPosition()
      setStep('sending')
      await punchIn.mutateAsync(position)
      setOpen(true) // show the server's result
    } catch (caught) {
      // Location errors are already written for the member; server errors go through errorMessage.
      setError(caught instanceof LocationError ? caught.message : errorMessage(caught))
    } finally {
      setStep('idle')
    }
  }

  if (mine.isPending) return null
  const record = mine.data
  const windowText = rules
    ? `Open ${timeLabel(rules.punch_open)} – ${timeLabel(rules.punch_close)}, on time until ${timeLabel(rules.on_time_cutoff)}`
    : undefined
  const buttonLabel =
    step === 'locating' ? 'Locating…' : step === 'sending' ? 'Sending…' : 'Punch In'
  const popovers = (
    <Popovers variant={variant} record={record} open={open} error={error} venueName={venueName} />
  )

  if (variant === 'bar') {
    // Once punched in, the bar only stays up while it shows the server's result.
    if (record && !open) return null
    return (
      <>
        {/* Spacer so the floating bar never covers the end of the page. */}
        <div aria-hidden="true" className="h-20 xl:hidden" />
        <div
          ref={ref}
          className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-xl xl:hidden"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white/95 p-2.5 pl-4 shadow-lg shadow-emerald-900/10 backdrop-blur-md">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-gray-900">
                Game day · {venueName}
              </span>
              {windowText && (
                <span className="block truncate text-[11px] text-gray-500">{windowText}</span>
              )}
            </span>
            {record ? (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold whitespace-nowrap text-emerald-700"
              >
                <Icon name="checkCircle" className="h-5 w-5 text-emerald-600" />
                <span>Done</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePunchIn}
                disabled={step !== 'idle'}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold whitespace-nowrap text-white shadow-sm shadow-emerald-600/30 transition-all select-none hover:bg-emerald-600 active:scale-95 disabled:cursor-wait disabled:opacity-70"
              >
                <Icon name="fingerprint" className="h-5 w-5" />
                <span>{buttonLabel}</span>
              </button>
            )}
          </div>
          {popovers}
        </div>
      </>
    )
  }

  return (
    // Below xl only the "Punched In" chip shows here; the button is in the bottom bar.
    <div ref={ref} className={record ? 'relative' : 'relative hidden xl:block'}>
      {record ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-emerald-700 shadow-sm"
        >
          <Icon name="checkCircle" className="h-4 w-4 text-emerald-600" />
          <span>Punched In</span>
          <span className="ml-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handlePunchIn}
          disabled={step !== 'idle'}
          title={windowText}
          className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-white shadow-sm transition-all select-none hover:bg-emerald-600 active:scale-95 disabled:cursor-wait disabled:opacity-70"
        >
          <Icon name="fingerprint" className="h-4 w-4" />
          <span>{buttonLabel}</span>
        </button>
      )}
      {popovers}
    </div>
  )
}

function Popovers({
  variant,
  record,
  open,
  error,
  venueName,
}: {
  variant: Variant
  record: ReturnType<typeof useMyAttendance>['data']
  open: boolean
  error: string | null
  venueName: string
}) {
  return (
    <>
      {record && open && (
        <div role="status" className={popoverClass[variant]}>
          <p className="text-xs font-semibold tracking-wide text-emerald-700 uppercase">
            You’re punched in
          </p>
          <p className="mt-1 flex items-center gap-2 text-xl font-bold tracking-tight text-gray-900 tabular-nums">
            {formatNepalTime(new Date(record.punched_in_at))}
            <ResultBadge result={record.status} />
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {venueName} · {evidenceText(record)}
          </p>
          {record.fine && (
            <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-amber-800">
              Late fine: <strong>{formatNpr(record.fine.amount_npr)}</strong> ({record.fine.status})
            </p>
          )}
        </div>
      )}

      {!record && error && (
        <div className={popoverClass[variant]}>
          <div role="alert" className="flex items-start gap-2 text-rose-700">
            <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Your location is read once, when you tap Punch In. The official time comes from the
            server.
          </p>
        </div>
      )}
    </>
  )
}
