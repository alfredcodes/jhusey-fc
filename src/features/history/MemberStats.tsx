import { FormError } from '../../components/form.tsx'
import { LoadingRows, StatCard } from '../../components/ui.tsx'
import { formatNpr } from '../../lib/format.ts'
import { errorMessage } from '../../lib/errors.ts'
import { useMyFines, useMyHistory } from './queries.ts'
import { summarize } from './summary.ts'

/** Personal numbers, all calculated from database records. */
export default function MemberStats() {
  const history = useMyHistory()
  const fines = useMyFines()

  if (history.isError) return <FormError message={errorMessage(history.error)} />
  if (fines.isError) return <FormError message={errorMessage(fines.error)} />
  if (!history.data || !fines.data) return <LoadingRows rows={1} />

  const s = summarize(history.data, fines.data)

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        label="My attendance"
        icon="checkCircle"
        tone="blue"
        value={s.attendancePercent === null ? '–' : `${s.attendancePercent}%`}
        footerNote={`${s.attended} of ${s.counted} sessions`}
      />
      <StatCard label="On time" icon="clock" tone="green" value={s.onTime} unit="sessions" />
      <StatCard
        label="Late · Absent"
        icon="warning"
        tone="amber"
        value={`${s.late} · ${s.absent}`}
        footerNote={s.excused ? `${s.excused} excused` : undefined}
      />
      <StatCard
        label="My fines due"
        icon="receipt"
        tone="red"
        value={formatNpr(s.fines.outstanding)}
        footerNote={`Paid ${formatNpr(s.fines.paid)}${s.fines.waived ? ` · Waived ${formatNpr(s.fines.waived)}` : ''}`}
      />
    </div>
  )
}
