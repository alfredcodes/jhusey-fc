import { useMemo, useState } from 'react'
import { FormError } from '../../components/form.tsx'
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  LoadingRows,
  PageHeader,
  SearchInput,
  Td,
  Th,
  TableFrame,
  type Tone,
} from '../../components/ui.tsx'
import { errorMessage } from '../../lib/errors.ts'
import { formatNepalDate, formatNepalTime } from '../../lib/nepal-time.ts'
import { useTeamMembers } from '../team/queries.ts'
import { useAuditLog } from './queries.ts'

const actions: Record<string, { label: string; tone: Tone }> = {
  'attendance.corrected': { label: 'Attendance corrected', tone: 'amber' },
  'attendance.recorded': { label: 'Attendance recorded', tone: 'blue' },
  'absence.excused': { label: 'Absence excused', tone: 'purple' },
  'fine.waived': { label: 'Fine waived', tone: 'gray' },
  'payment.recorded': { label: 'Payment recorded', tone: 'green' },
  'payment.voided': { label: 'Payment voided', tone: 'red' },
  'member.updated': { label: 'Member updated', tone: 'blue' },
  'member.created': { label: 'Member created', tone: 'green' },
  'member.password_reset': { label: 'Password reset', tone: 'amber' },
  'member.phone_updated': { label: 'Phone updated', tone: 'gray' },
  'rules.updated': { label: 'Rules changed', tone: 'red' },
}

const RULE_LABELS: Record<string, string> = {
  club_name: 'club name',
  punch_open: 'opens',
  on_time_cutoff: 'cutoff',
  punch_close: 'closes',
  late_fine_npr: 'late fine',
  absence_fine_npr: 'absence fine',
  absence_fines_from: 'absence fines from',
}

function describe(
  action: string,
  details: Record<string, unknown>,
  names: Map<string, string>,
): string {
  const who = typeof details.member_id === 'string' ? names.get(details.member_id) : undefined
  const prefix = who ? `${who}: ` : ''
  switch (action) {
    case 'attendance.corrected':
      return `${prefix}${details.from} → ${details.to}; fine ${details.fine}`
    case 'attendance.recorded':
      return `${prefix}arrived ${String(details.arrived_at).slice(0, 5)}, ${details.status}`
    case 'absence.excused':
      return `${prefix}fine ${details.fine}`
    case 'payment.recorded':
    case 'payment.voided':
    case 'fine.waived':
      return `${prefix}Rs. ${details.amount_npr}`
    case 'member.created':
      return `${details.display_name} <${details.email}>`
    case 'member.updated': {
      const from = details.from as { display_name: string; is_active: boolean }
      const to = details.to as { display_name: string; is_active: boolean }
      const changes = []
      if (from.display_name !== to.display_name)
        changes.push(`${from.display_name} → ${to.display_name}`)
      if (from.is_active !== to.is_active) changes.push(to.is_active ? 'activated' : 'deactivated')
      return changes.join('; ') || 'no change'
    }
    case 'rules.updated': {
      const from = details.from as Record<string, unknown>
      const to = details.to as Record<string, unknown>
      return (
        Object.keys(RULE_LABELS)
          .filter((key) => from?.[key] !== to?.[key])
          .map((key) => `${RULE_LABELS[key]} ${from[key]} → ${to[key]}`)
          .join('; ') || 'no change'
      )
    }
    default:
      return ''
  }
}

/** Read-only record of every admin action. Nobody can edit or delete it from the app. */
export default function AuditPage() {
  const log = useAuditLog()
  const members = useTeamMembers()
  const [search, setSearch] = useState('')
  const names = useMemo(
    () => new Map((members.data ?? []).map((member) => [member.id, member.display_name])),
    [members.data],
  )
  const rows = (log.data ?? []).filter((entry) => {
    const text = `${actions[entry.action]?.label ?? entry.action} ${describe(entry.action, entry.details as Record<string, unknown>, names)} ${entry.reason ?? ''}`
    return text.toLowerCase().includes(search.trim().toLowerCase())
  })

  return (
    <>
      <PageHeader
        title="Audit Log"
        badges={<Badge tone="purple">Admin only</Badge>}
        description="Every admin action: who, what, when and why. It cannot be edited or deleted."
      />
      <Card>
        <div className="border-b border-gray-100 p-4 sm:p-5">
          <SearchInput
            label="Search the log"
            value={search}
            onChange={setSearch}
            placeholder="Search actions, members, reasons…"
          />
        </div>
        {log.isPending && <LoadingRows />}
        {log.isError && (
          <div className="p-5">
            <FormError message={errorMessage(log.error)} />
          </div>
        )}
        {log.data && rows.length === 0 && <EmptyState icon="shield" title="No admin actions yet" />}
        {rows.length > 0 && (
          <TableFrame caption="Audit log">
            <thead className="border-b border-gray-100 bg-gray-50/60">
              <tr>
                <Th>When</Th>
                <Th>Action</Th>
                <Th>Details</Th>
                <Th className="hidden md:table-cell">Reason</Th>
                <Th className="hidden sm:table-cell">By</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((entry) => {
                const at = new Date(entry.created_at)
                const action = actions[entry.action] ?? {
                  label: entry.action,
                  tone: 'gray' as Tone,
                }
                return (
                  <tr key={entry.id} className="align-top">
                    <Td>
                      <p className="whitespace-nowrap text-gray-900">{formatNepalDate(at)}</p>
                      <p className="text-[11px] text-gray-400">{formatNepalTime(at)}</p>
                    </Td>
                    <Td>
                      <Badge tone={action.tone}>{action.label}</Badge>
                    </Td>
                    <Td className="text-gray-600">
                      {describe(entry.action, entry.details as Record<string, unknown>, names)}
                      {entry.reason && (
                        <p className="mt-1 text-[11px] text-gray-400 md:hidden">“{entry.reason}”</p>
                      )}
                    </Td>
                    <Td className="hidden text-gray-600 md:table-cell">
                      {entry.reason ? `“${entry.reason}”` : '—'}
                    </Td>
                    <Td className="hidden sm:table-cell">
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <Avatar name={entry.actor?.display_name ?? '?'} size="sm" />
                        {entry.actor?.display_name}
                      </span>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </TableFrame>
        )}
      </Card>
    </>
  )
}
