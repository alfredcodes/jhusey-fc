import { FormError } from '../../components/form.tsx'
import { errorMessage } from '../../lib/errors.ts'
import { useMyFines, useMyHistory } from './queries.ts'
import { summarize } from './summary.ts'

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium text-slate-600 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {note && <p className="text-xs text-slate-600">{note}</p>}
    </div>
  )
}

/** Personal numbers, all calculated from database records. */
export default function MemberStats() {
  const history = useMyHistory()
  const fines = useMyFines()

  if (history.isError) return <FormError message={errorMessage(history.error)} />
  if (fines.isError) return <FormError message={errorMessage(fines.error)} />
  if (!history.data || !fines.data) return <p className="text-slate-600">Loading your stats…</p>

  const s = summarize(history.data, fines.data)

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat
        label="Attendance"
        value={s.attendancePercent === null ? '–' : `${s.attendancePercent}%`}
        note={`${s.attended} of ${s.counted} sessions`}
      />
      <Stat label="On time" value={String(s.onTime)} />
      <Stat label="Late · Absent" value={`${s.late} · ${s.absent}`} />
      <Stat
        label="Fines due"
        value={`NPR ${s.fines.outstanding}`}
        note={`Paid NPR ${s.fines.paid}${s.fines.waived ? ` · Waived NPR ${s.fines.waived}` : ''}`}
      />
    </div>
  )
}
