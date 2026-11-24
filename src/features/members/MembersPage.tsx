import { useMemo, useState, type FormEvent } from 'react'
import {
  FormError,
  FormSuccess,
  inputClass,
  labelClass,
  linkButtonClass,
  primaryAutoButtonClass,
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
import { loginName } from '../../lib/login-name.ts'
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
import { FEE_PLANS, planLabel, useSetFeePlan, type FeePlan } from '../fees/queries.ts'
import { useIsAdmin, useTeamMembers, useTeamReport, type TeamMember } from '../team/queries.ts'

type Row = TeamMember & {
  percent: number | null
  attended: number
  sessions: number
  due: number
  account?: MemberAccount
}

type MemberFilter = 'all' | 'active' | 'partial' | 'inactive'

const MEMBER_FILTERS: { value: MemberFilter; label: string }[] = [
  { value: 'all', label: 'All members' },
  { value: 'active', label: 'Active' },
  { value: 'partial', label: 'Partial plan' },
  { value: 'inactive', label: 'Inactive' },
]

/** Active / Inactive = account status; Partial = on the partial fee plan (active or not). */
function matchesFilter(row: { is_active: boolean; fee_plan: string }, filter: MemberFilter) {
  if (filter === 'active') return row.is_active
  if (filter === 'inactive') return !row.is_active
  if (filter === 'partial') return row.fee_plan === 'partial'
  return true
}

export default function MembersPage() {
  const isAdmin = useIsAdmin()
  const today = nepalToday()
  const members = useTeamMembers()
  const report = useTeamReport({ from: addDays(today, -365), to: today })
  const accounts = useMemberAccounts(isAdmin)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<MemberFilter>('all')
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
        matchesFilter(row, status),
    )
    const by: Record<string, (a: Row, b: Row) => number> = {
      name: (a, b) => a.display_name.localeCompare(b.display_name),
      attendance: (a, b) => (b.percent ?? -1) - (a.percent ?? -1),
      fines: (a, b) => b.due - a.due,
    }
    return filtered.sort(by[sort])
  }, [all, search, status, sort])

  const count = (filter: MemberFilter) => all.filter((row) => matchesFilter(row, filter)).length

  function exportCsv() {
    downloadCsv(
      `jhusey-fc-members-${today}.csv`,
      toCsv(rows, [
        { header: 'Member', value: (r) => r.display_name },
        { header: 'Role', value: (r) => r.role },
        { header: 'Active', value: (r) => (r.is_active ? 'yes' : 'no') },
        { header: 'Fee plan', value: (r) => planLabel(r.fee_plan) },
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
                className={primaryAutoButtonClass}
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
          label="Total members"
          icon="team"
          tone="blue"
          value={members.data ? all.length : '–'}
          unit="on the roster"
        />
        <StatCard
          label="Active members"
          icon="checkCircle"
          tone="green"
          value={members.data ? count('active') : '–'}
          unit="can sign in"
        />
        <StatCard
          label="Partial members"
          icon="users"
          tone="amber"
          value={members.data ? count('partial') : '–'}
          unit="partial fee plan"
        />
        <StatCard
          label="Inactive members"
          icon="userX"
          tone="gray"
          value={members.data ? count('inactive') : '–'}
          unit="history kept"
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
              label="Show"
              value={status}
              onChange={(value) => setStatus(value as MemberFilter)}
              options={MEMBER_FILTERS}
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
                          {planLabel(row.fee_plan)} plan · Joined{' '}
                          {formatNepalDate(new Date(row.created_at))}
                        </p>
                      </div>
                    </div>
                  </Td>
                  {isAdmin && (
                    <Td className="hidden lg:table-cell">
                      <p className="text-gray-700">{loginName(row.account?.email)}</p>
                      <p className="text-[11px] text-gray-400">
                        {row.account?.phone ?? 'No phone'}
                        {row.account?.must_change_password && ' · must change password'}
                      </p>
                    </Td>
                  )}
                  <Td label="Attendance (12 months)">
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
                  <Td label="Fines due" className="hidden sm:table-cell">
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
                        {/* Admins change their own password (Settings → Security). */}
                        {row.role !== 'admin' && (
                          <button
                            type="button"
                            className={linkButtonClass}
                            onClick={() => setResetting(row)}
                          >
                            Reset password
                          </button>
                        )}
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
  username,
  password,
  name,
}: {
  username: string
  password: string
  name: string
}) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `Jhusey FC login\nUsername: ${username}\nPassword: ${password}`,
      )
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
            <dt className="w-20 text-gray-500">Username</dt>
            <dd className="font-mono break-all">{username}</dd>
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
  const [done, setDone] = useState<{ username: string; name: string; password: string } | null>(
    null,
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name')).trim()
    setError(null)
    try {
      const result = await create.mutateAsync({
        displayName: name,
        username: String(form.get('username')).trim(),
        phone: String(form.get('phone')).trim(),
        password,
      })
      setDone({ username: loginName(result.email), name, password })
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
          <CredentialsPanel username={done.username} password={done.password} name={done.name} />
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
            Username (used to sign in)
            <input
              name="username"
              required
              minLength={2}
              maxLength={30}
              pattern="[a-z0-9][a-z0-9._\-]{1,29}"
              title="2 to 30 lowercase letters, digits, dot, dash or underscore"
              autoCapitalize="none"
              spellCheck={false}
              className={inputClass}
              autoComplete="off"
              placeholder="e.g. kamal or 9841234567"
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
  const setPlan = useSetFeePlan()
  const { data: me } = useProfile()
  const [error, setError] = useState<string | null>(null)
  const isMe = me?.id === member.id
  // Admin accounts stay active: remove the admin role first (SQL), then deactivate.
  const keepActive = isMe || member.role === 'admin'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name')).trim()
    setError(null)
    try {
      await update.mutateAsync({
        id: member.id,
        displayName: name,
        isActive: keepActive || form.get('active') === 'on',
        phone: String(form.get('phone')).trim(),
      })
      const plan = String(form.get('plan')) as FeePlan
      if (plan !== member.fee_plan) await setPlan.mutateAsync({ memberId: member.id, plan })
      onDone(`${name} saved.`)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <Modal
      title={`Edit ${member.display_name}`}
      description={loginName(member.account?.email)}
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
        <label className={labelClass}>
          Monthly fee plan
          <select name="plan" defaultValue={member.fee_plan} className={inputClass}>
            {FEE_PLANS.map((plan) => (
              <option key={plan.value} value={plan.value}>
                {plan.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-gray-400">
            Applies from the next month opened. Existing fees keep their amount.
          </span>
        </label>
        {!keepActive && (
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
          <button
            type="submit"
            disabled={update.isPending || setPlan.isPending}
            className={primaryButtonClass}
          >
            {update.isPending || setPlan.isPending ? 'Saving…' : 'Save'}
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
            username={loginName(member.account?.email)}
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
