import { useMemo, useState, type FormEvent } from 'react'
import {
  FormError,
  FormSuccess,
  inputClass,
  labelClass,
  linkButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../components/form.tsx'
import { PercentBar } from '../../components/charts.tsx'
import { Icon } from '../../components/icons.tsx'
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  LoadingRows,
  Modal,
  PageHeader,
  SearchInput,
  SelectFilter,
  StatCard,
  Td,
  Th,
  TableFrame,
} from '../../components/ui.tsx'
import { formatNpr } from '../../lib/format.ts'
import { downloadCsv, toCsv } from '../../lib/csv.ts'
import { errorMessage } from '../../lib/errors.ts'
import { addDays, formatNepalDate, nepalToday } from '../../lib/nepal-time.ts'
import { useProfile } from '../auth/use-profile.ts'
import {
  generatePassword,
  useCreateMember,
  useMemberAccounts,
  useResetPassword,
  useUpdateMember,
  type MemberAccount,
} from '../admin/queries.ts'
import { useIsAdmin, useTeamMembers, useTeamReport, type TeamMember } from '../team/queries.ts'

type Row = TeamMember & {
  percent: number | null
  attended: number
  sessions: number
  due: number
  account?: MemberAccount
}

export default function MembersPage() {
  const isAdmin = useIsAdmin()
  const today = nepalToday()
  const members = useTeamMembers()
  const report = useTeamReport({ from: addDays(today, -365), to: today })
  const accounts = useMemberAccounts(isAdmin)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [sort, setSort] = useState('name')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [resetting, setResetting] = useState<Row | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const all: Row[] = useMemo(() => {
    const stats = new Map((report.data ?? []).map((row) => [row.member_id, row]))
    const logins = new Map((accounts.data ?? []).map((row) => [row.member_id, row]))
    return (members.data ?? []).map((member) => {
      const s = stats.get(member.id)
      return {
        ...member,
        percent: s?.attendance_percent ?? null,
        attended: s ? s.on_time + s.late : 0,
        sessions: s?.sessions ?? 0,
        due: s?.fines_outstanding_npr ?? 0,
        account: logins.get(member.id),
      }
    })
  }, [members.data, report.data, accounts.data])

  const rows = useMemo(() => {
    const filtered = all.filter(
      (row) =>
        row.display_name.toLowerCase().includes(search.trim().toLowerCase()) &&
        (status === 'all' || (status === 'active') === row.is_active),
    )
    const by: Record<string, (a: Row, b: Row) => number> = {
      name: (a, b) => a.display_name.localeCompare(b.display_name),
      attendance: (a, b) => (b.percent ?? -1) - (a.percent ?? -1),
      fines: (a, b) => b.due - a.due,
    }
    return filtered.sort(by[sort])
  }, [all, search, status, sort])

  const active = all.filter((row) => row.is_active)
  const withStats = active.filter((row) => row.percent !== null)
  const average = withStats.length
    ? Math.round(withStats.reduce((sum, row) => sum + (row.percent ?? 0), 0) / withStats.length)
    : null
  const owing = active.filter((row) => row.due > 0).length

  function exportCsv() {
    downloadCsv(
      `jhusey-fc-members-${today}.csv`,
      toCsv(rows, [
        { header: 'Member', value: (r) => r.display_name },
        { header: 'Role', value: (r) => r.role },
        { header: 'Active', value: (r) => (r.is_active ? 'yes' : 'no') },
        { header: 'Sessions (12 months)', value: (r) => r.sessions },
        { header: 'Attended', value: (r) => r.attended },
        { header: 'Attendance %', value: (r) => r.percent },
        { header: 'Fines due (NPR)', value: (r) => r.due },
      ]),
    )
  }

  return (
    <>
      <PageHeader
        title="Club Members"
        badges={<Badge tone="blue">{rows.length} listed</Badge>}
        description="Roster, attendance over the last 12 months and fines due."
        actions={
          <>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={exportCsv}
              disabled={rows.length === 0}
            >
              <Icon name="download" className="h-4 w-4" /> Export
            </button>
            {isAdmin && (
              <button
                type="button"
                className={`${primaryButtonClass} w-auto`}
                onClick={() => setAdding(true)}
              >
                <Icon name="plus" className="h-4 w-4" /> Add member
              </button>
            )}
          </>
        }
      />
      <FormSuccess message={message} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total roster"
          icon="team"
          tone="blue"
          value={active.length}
          unit={`active of ${all.length}`}
        />
        <StatCard
          label="Avg attendance"
          icon="checkCircle"
          tone="green"
          value={average === null ? '–' : `${average}%`}
          unit="12 months"
        />
        <StatCard
          label="Members owing"
          icon="receipt"
          tone="amber"
          value={owing}
          unit="with fines due"
        />
        <StatCard
          label="Administrators"
          icon="shield"
          tone="purple"
          value={all.filter((r) => r.role === 'admin').length}
          unit="Captain & admin"
        />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <SearchInput
            label="Search members"
            value={search}
            onChange={setSearch}
            placeholder="Search player by name…"
          />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <SelectFilter
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'all', label: 'All statuses' },
              ]}
            />
            <SelectFilter
              label="Sort"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'name', label: 'Sort: Name' },
                { value: 'attendance', label: 'Sort: Attendance' },
                { value: 'fines', label: 'Sort: Fines due' },
              ]}
            />
          </div>
        </div>
        {(members.isPending || report.isPending) && <LoadingRows />}
        {members.isError && (
          <div className="p-5">
            <FormError message={errorMessage(members.error)} />
          </div>
        )}
        {members.data && rows.length === 0 && <EmptyState icon="users" title="No members match" />}
        {members.data && rows.length > 0 && (
          <TableFrame caption="Club members">
            <thead className="border-b border-gray-100 bg-gray-50/60">
              <tr>
                <Th>Member</Th>
                {isAdmin && <Th className="hidden lg:table-cell">Login & phone</Th>}
                <Th>Attendance (12 months)</Th>
                <Th className="hidden sm:table-cell">Fines due</Th>
                <Th className="hidden sm:table-cell">Status</Th>
                {isAdmin && <Th align="right">Actions</Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-gray-50/60">
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={row.display_name} />
                      <div>
                        <p
                          className={`font-semibold ${row.is_active ? 'text-gray-900' : 'text-gray-400'}`}
                        >
                          {row.display_name}
                          {row.role === 'admin' && (
                            <Badge tone="purple" className="ml-2">
                              Admin
                            </Badge>
                          )}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          Joined {formatNepalDate(new Date(row.created_at))}
                        </p>
                      </div>
                    </div>
                  </Td>
                  {isAdmin && (
                    <Td className="hidden lg:table-cell">
                      <p className="text-gray-700">{row.account?.email}</p>
                      <p className="text-[11px] text-gray-400">
                        {row.account?.phone ?? 'No phone'}
                        {row.account?.must_change_password && ' · must change password'}
                      </p>
                    </Td>
                  )}
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <PercentBar
                        percent={row.percent}
                        tone={row.percent !== null && row.percent < 75 ? 'bad' : undefined}
                      />
                      <span className="text-xs font-semibold text-gray-700 tabular-nums">
                        {row.percent === null ? '–' : `${row.percent}%`}
                      </span>
                      <span className="hidden text-[11px] text-gray-400 sm:inline">
                        ({row.attended}/{row.sessions})
                      </span>
                    </div>
                  </Td>
                  <Td className="hidden sm:table-cell">
                    {row.due > 0 ? (
                      <span className="font-semibold text-rose-600">{formatNpr(row.due)}</span>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </Td>
                  <Td className="hidden sm:table-cell">
                    {row.is_active ? (
                      <Badge tone="green" dot>
                        Active
                      </Badge>
                    ) : (
                      <Badge tone="gray" dot>
                        Inactive
                      </Badge>
                    )}
                  </Td>
                  {isAdmin && (
                    <Td align="right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className={linkButtonClass}
                          onClick={() => setEditing(row)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={linkButtonClass}
                          onClick={() => setResetting(row)}
                        >
                          Reset password
                        </button>
                      </div>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </Card>

      {adding && <AddMemberModal onClose={() => setAdding(false)} />}
      {editing && (
        <EditMemberModal
          member={editing}
          onClose={() => setEditing(null)}
          onDone={(text) => {
            setEditing(null)
            setMessage(text)
          }}
        />
      )}
      {resetting && <ResetPasswordModal member={resetting} onClose={() => setResetting(null)} />}
    </>
  )
}

/** The password is shown once, here, and never stored by the app. */
function CredentialsPanel({
  email,
  password,
  name,
}: {
  email: string
  password: string
  name: string
}) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(`Jhusey FC login\nEmail: ${email}\nPassword: ${password}`)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm">
        <p className="font-semibold text-emerald-800">Share this login with {name}</p>
        <dl className="mt-2 space-y-1 text-gray-800">
          <div className="flex gap-2">
            <dt className="w-20 text-gray-500">Email</dt>
            <dd className="font-mono break-all">{email}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 text-gray-500">Password</dt>
            <dd className="font-mono break-all">{password}</dd>
          </div>
        </dl>
      </div>
      <p className="text-xs text-gray-500">
        This password is shown only now; it is not saved anywhere you can see again. Send it
        privately (e.g. WhatsApp). {name} will be asked to choose a new password at first sign-in.
      </p>
      <button type="button" className={secondaryButtonClass} onClick={copy}>
        <Icon name="copy" className="h-4 w-4" /> {copied ? 'Copied' : 'Copy login details'}
      </button>
    </div>
  )
}

function PasswordField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className={labelClass} htmlFor="initial-password">
        Initial password
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id="initial-password"
          name="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} mt-0 font-mono`}
        />
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => onChange(generatePassword())}
        >
          Generate
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-400">At least 8 characters.</p>
    </div>
  )
}

function AddMemberModal({ onClose }: { onClose: () => void }) {
  const create = useCreateMember()
  const [password, setPassword] = useState(() => generatePassword())
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ email: string; name: string; password: string } | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name')).trim()
    setError(null)
    try {
      const result = await create.mutateAsync({
        displayName: name,
        email: String(form.get('email')).trim(),
        phone: String(form.get('phone')).trim(),
        password,
      })
      setDone({ email: result.email ?? String(form.get('email')), name, password })
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <Modal
      title={done ? 'Member added' : 'Add member'}
      description={
        done ? undefined : 'Creates their login. No email is sent; you share the login yourself.'
      }
      onClose={onClose}
    >
      {done ? (
        <div className="space-y-4">
          <CredentialsPanel email={done.email} password={done.password} name={done.name} />
          <button type="button" className={primaryButtonClass} onClick={onClose}>
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className={labelClass}>
            Full name
            <input name="name" required maxLength={60} className={inputClass} autoComplete="off" />
          </label>
          <label className={labelClass}>
            Email (used to sign in)
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              className={inputClass}
              autoComplete="off"
            />
          </label>
          <label className={labelClass}>
            Phone / WhatsApp (optional, admin only)
            <input
              name="phone"
              inputMode="tel"
              maxLength={20}
              pattern="\+?[0-9 ]{7,20}"
              className={inputClass}
              placeholder="+977 98…"
            />
          </label>
          <PasswordField value={password} onChange={setPassword} />
          <FormError message={error} />
          <div className="flex gap-2">
            <button type="submit" disabled={create.isPending} className={primaryButtonClass}>
              {create.isPending ? 'Creating…' : 'Create member'}
            </button>
            <button type="button" className={secondaryButtonClass} onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

function EditMemberModal({
  member,
  onClose,
  onDone,
}: {
  member: Row
  onClose: () => void
  onDone: (message: string) => void
}) {
  const update = useUpdateMember()
  const { data: me } = useProfile()
  const [error, setError] = useState<string | null>(null)
  const isMe = me?.id === member.id

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name')).trim()
    setError(null)
    try {
      await update.mutateAsync({
        id: member.id,
        displayName: name,
        isActive: isMe || form.get('active') === 'on',
        phone: String(form.get('phone')).trim(),
      })
      onDone(`${name} saved.`)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <Modal
      title={`Edit ${member.display_name}`}
      description={member.account?.email}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className={labelClass}>
          Display name
          <input
            name="name"
            required
            maxLength={60}
            defaultValue={member.display_name}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Phone / WhatsApp
          <input
            name="phone"
            inputMode="tel"
            maxLength={20}
            pattern="\+?[0-9 ]{7,20}"
            defaultValue={member.account?.phone ?? ''}
            className={inputClass}
          />
        </label>
        {!isMe && (
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              name="active"
              type="checkbox"
              defaultChecked={member.is_active}
              className="h-4 w-4 rounded border-gray-300"
            />
            Active (inactive members cannot sign in; their history is kept)
          </label>
        )}
        <FormError message={error} />
        <div className="flex gap-2">
          <button type="submit" disabled={update.isPending} className={primaryButtonClass}>
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className={secondaryButtonClass} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ResetPasswordModal({ member, onClose }: { member: Row; onClose: () => void }) {
  const reset = useResetPassword()
  const { data: me } = useProfile()
  const [password, setPassword] = useState(() => generatePassword())
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      await reset.mutateAsync({ memberId: member.id, password })
      setDone(true)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  if (me?.id === member.id) {
    return (
      <Modal title="Reset password" onClose={onClose}>
        <p className="text-sm text-gray-600">Change your own password in Settings → Security.</p>
      </Modal>
    )
  }

  return (
    <Modal
      title={done ? 'Temporary password set' : `Reset password for ${member.display_name}`}
      description={
        done
          ? undefined
          : 'For a member who forgot their password. They choose a new one at next sign-in.'
      }
      onClose={onClose}
    >
      {done ? (
        <div className="space-y-4">
          <CredentialsPanel
            email={member.account?.email ?? ''}
            password={password}
            name={member.display_name}
          />
          <button type="button" className={primaryButtonClass} onClick={onClose}>
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField value={password} onChange={setPassword} />
          <FormError message={error} />
          <div className="flex gap-2">
            <button type="submit" disabled={reset.isPending} className={primaryButtonClass}>
              {reset.isPending ? 'Saving…' : 'Set temporary password'}
            </button>
            <button type="button" className={secondaryButtonClass} onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
