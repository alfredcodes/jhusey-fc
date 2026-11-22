import { Badge, type Tone } from '../../components/ui.tsx'
import { formatNpr } from '../../lib/format.ts'

export type Result = 'on_time' | 'late' | 'absent' | 'excused' | 'open' | 'cancelled'

const results: Record<Result, { label: string; tone: Tone }> = {
  on_time: { label: 'On time', tone: 'green' },
  late: { label: 'Late', tone: 'amber' },
  absent: { label: 'Absent', tone: 'red' },
  excused: { label: 'Excused', tone: 'gray' },
  open: { label: 'Not yet', tone: 'blue' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
}

export function ResultBadge({ result, children }: { result: string; children?: string }) {
  const known = results[result as Result] ?? { label: result, tone: 'gray' as Tone }
  return (
    <Badge tone={known.tone} dot>
      {children ?? known.label}
    </Badge>
  )
}

export function FineBadge({
  reason,
  amount,
  status,
}: {
  reason: string | null
  amount: number | null
  status: string | null
}) {
  if (amount === null || reason === null) return <span className="text-gray-400">None</span>
  const label = `${reason === 'late' ? 'Late fine' : 'Absent fine'} (${formatNpr(amount)})`
  if (status === 'waived')
    return (
      <Badge tone="gray" className="line-through decoration-gray-400">
        {label}
      </Badge>
    )
  if (status === 'paid') return <Badge tone="green">{label} · paid</Badge>
  return <Badge tone={reason === 'late' ? 'amber' : 'red'}>{label}</Badge>
}

export function FineStatusBadge({ status }: { status: string }) {
  if (status === 'paid')
    return (
      <Badge tone="green" dot>
        Paid
      </Badge>
    )
  if (status === 'waived')
    return (
      <Badge tone="gray" dot>
        Waived
      </Badge>
    )
  return (
    <Badge tone="red" dot>
      Unpaid
    </Badge>
  )
}
