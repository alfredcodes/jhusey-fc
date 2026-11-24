import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import {
  FormError,
  FormSuccess,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '../../components/form.tsx'
import { Icon, type IconName } from '../../components/icons.tsx'
import { Avatar, Badge, Card, CardHeader, PageHeader } from '../../components/ui.tsx'
import { errorMessage } from '../../lib/errors.ts'
import { loginName } from '../../lib/login-name.ts'
import { nepalToday } from '../../lib/nepal-time.ts'
import { supabase } from '../../lib/supabase.ts'
import { useAuth } from '../auth/auth-context.ts'
import { useMyPrivate } from '../auth/use-private.ts'
import { useProfile } from '../auth/use-profile.ts'
import {
  timeLabel,
  useClubRules,
  useIsAdmin,
  useUpdateRules,
  type ClubRules,
} from '../team/queries.ts'
import { useUpdatePaymentSettings } from '../fees/queries.ts'
import FutsalSettings from './FutsalSettings.tsx'
import PasswordForm from './PasswordForm.tsx'

type Tab = 'profile' | 'security' | 'club' | 'futsal' | 'rules'

const TABS: { id: Tab; label: string; icon: IconName; adminOnly: boolean }[] = [
  { id: 'profile', label: 'Profile & Account', icon: 'users', adminOnly: false },
  { id: 'security', label: 'Security & Password', icon: 'key', adminOnly: false },
  { id: 'club', label: 'Club', icon: 'shield', adminOnly: true },
  { id: 'futsal', label: 'Futsal', icon: 'pin', adminOnly: true },
  { id: 'rules', label: 'Rules', icon: 'rule', adminOnly: true },
]

/**
 * Members see only their own settings. Club, Futsal and Rules are hidden from them,
 * and the database refuses their changes even if a URL is typed by hand.
 */
export default function SettingsPage() {
  const isAdmin = useIsAdmin()
  const [params, setParams] = useSearchParams()
  const tabs = TABS.filter((tab) => isAdmin || !tab.adminOnly)
  const requested = params.get('tab') as Tab | null
  const active = tabs.find((tab) => tab.id === requested)?.id ?? 'profile'

  return (
    <>
      <PageHeader
        title="Settings & Preferences"
        description={
          isAdmin
            ? 'Your profile and password, plus the club, venue and rule settings.'
            : 'Your profile and password.'
        }
      />
      <div
        role="tablist"
        aria-label="Settings sections"
        className="flex snap-x gap-1 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1.5 shadow-sm [scrollbar-width:none] [&>*]:snap-start"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={active === tab.id}
            onClick={() => setParams(tab.id === 'profile' ? {} : { tab: tab.id })}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm transition-colors ${
              active === tab.id
                ? 'bg-blue-50 font-semibold text-blue-600'
                : 'font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icon name={tab.icon} className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {active === 'profile' && <ProfileTab />}
        {active === 'security' && (
          <Card className="max-w-xl p-6">
            <CardHeader title="Change password" description="You need your current password." />
            <div className="mt-5">
              <PasswordForm requireCurrent />
            </div>
            <p className="mt-5 text-xs text-gray-400">
              Forgot it? The admin can set a temporary password for you from the Members page.
            </p>
          </Card>
        )}
        {active === 'club' && isAdmin && <ClubTab />}
        {active === 'futsal' && isAdmin && <FutsalSettings />}
        {active === 'rules' && isAdmin && (
          <div className="space-y-6">
            <RulesTab />
            <FeeAmountsCard />
          </div>
        )}
      </div>
    </>
  )
}

function ProfileTab() {
  const { session } = useAuth()
  const { data: profile } = useProfile()
  const mine = useMyPrivate()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError(null)
    setSaved(null)
    setBusy(true)
    try {
      const name = String(form.get('name')).trim()
      if (name !== profile?.display_name) {
        const { error: nameError } = await supabase
          .from('profiles')
          .update({ display_name: name })
          .eq('id', session!.user.id)
        if (nameError) throw nameError
      }
      const phone = String(form.get('phone')).trim()
      if (phone !== (mine.data?.phone ?? '')) {
        const { error: phoneError } = await supabase.rpc('update_my_phone', { p_phone: phone })
        if (phoneError) throw phoneError
      }
      await queryClient.invalidateQueries()
      setSaved('Profile saved.')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  if (!profile || mine.isPending) return null

  return (
    <Card className="max-w-2xl p-6">
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={profile.display_name} size="lg" />
        <div>
          <p className="flex items-center gap-2 text-lg font-bold text-gray-900">
            {profile.display_name}
            <Badge tone={profile.role === 'admin' ? 'purple' : 'blue'}>
              {profile.role === 'admin' ? 'Admin' : 'Member'}
            </Badge>
          </p>
          <p className="text-sm text-gray-500">{loginName(session?.user.email)}</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className={labelClass}>
          Display name
          <input
            name="name"
            required
            maxLength={60}
            defaultValue={profile.display_name}
            className={inputClass}
          />
          <span className="mt-1 block text-xs font-normal text-gray-400">
            Shown to the team on attendance and fines.
          </span>
        </label>
        <label className={labelClass}>
          Phone / WhatsApp
          <input
            name="phone"
            inputMode="tel"
            maxLength={20}
            pattern="\+?[0-9 ]{7,20}"
            defaultValue={mine.data?.phone ?? ''}
            className={inputClass}
          />
          <span className="mt-1 block text-xs font-normal text-gray-400">
            Only you and the admin can see it.
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Username (sign-in)
            <input
              value={loginName(session?.user.email)}
              disabled
              className={inputClass}
              readOnly
            />
            <span className="mt-1 block text-xs font-normal text-gray-400">
              Ask the admin to change it.
            </span>
          </label>
          <label className={labelClass}>
            Role
            <input
              value={profile.role === 'admin' ? 'Admin' : 'Member'}
              disabled
              className={inputClass}
              readOnly
            />
          </label>
        </div>
        <FormError message={error} />
        <FormSuccess message={saved} />
        <button type="submit" disabled={busy} className={`${primaryButtonClass} sm:w-auto`}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </Card>
  )
}

/** Club name, saved through the same audited rules function. */
function ClubTab() {
  const { data: rules } = useClubRules()
  const update = useUpdateRules()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  if (!rules) return null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError(null)
    setSaved(null)
    try {
      await update.mutateAsync({
        ...fromRules(rules!),
        clubName: String(form.get('club_name')).trim(),
      })
      setSaved('Club details saved.')
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <Card className="max-w-xl p-6">
      <CardHeader title="Club" description="Shown in the header for everyone." />
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <label className={labelClass}>
          Club name
          <input
            name="club_name"
            required
            maxLength={60}
            defaultValue={rules.club_name}
            className={inputClass}
          />
        </label>
        <FormError message={error} />
        <FormSuccess message={saved} />
        <button
          type="submit"
          disabled={update.isPending}
          className={`${primaryButtonClass} sm:w-auto`}
        >
          {update.isPending ? 'Saving…' : 'Save club'}
        </button>
      </form>
    </Card>
  )
}

function fromRules(rules: ClubRules) {
  return {
    clubName: rules.club_name,
    punchOpen: rules.punch_open,
    cutoff: rules.on_time_cutoff,
    punchClose: rules.punch_close,
    lateFine: rules.late_fine_npr,
    absenceFine: rules.absence_fine_npr,
    absenceFinesFrom: rules.absence_fines_from,
  }
}

/** HH:MM:SS for <input type="time" step="1">. */
const seconds = (time: string) => (time.length === 5 ? `${time}:00` : time)

function RulesTab() {
  const { data: rules } = useClubRules()
  const update = useUpdateRules()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  if (!rules) return null
  const today = nepalToday()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError(null)
    setSaved(null)
    try {
      await update.mutateAsync({
        clubName: rules!.club_name,
        punchOpen: seconds(String(form.get('punch_open'))),
        cutoff: seconds(String(form.get('cutoff'))),
        punchClose: seconds(String(form.get('punch_close'))),
        lateFine: Number(form.get('late_fine')),
        absenceFine: Number(form.get('absence_fine')),
        absenceFinesFrom: String(form.get('absence_from')),
      })
      setSaved(
        'Rules saved. They apply from the next punch-in; existing records keep their values.',
      )
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <Card className="max-w-3xl p-6">
      <CardHeader
        title="Pitch validation & disciplinary rules"
        description="Changes apply to punch-ins and fines from now on. Past attendance and fines never change."
      />
      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <fieldset className="space-y-4">
          <legend className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Icon name="clock" className="h-4 w-4 text-blue-600" /> Punch-in time window (Nepal
            time)
          </legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className={labelClass}>
              Opens
              <input
                name="punch_open"
                type="time"
                step={1}
                required
                defaultValue={rules.punch_open}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              On time until
              <input
                name="cutoff"
                type="time"
                step={1}
                required
                defaultValue={rules.on_time_cutoff}
                className={inputClass}
              />
              <span className="mt-1 block text-xs font-normal text-gray-400">
                Whole seconds: {timeLabel(rules.on_time_cutoff)}:00 is on time, one second later is
                late.
              </span>
            </label>
            <label className={labelClass}>
              Closes
              <input
                name="punch_close"
                type="time"
                step={1}
                required
                defaultValue={rules.punch_close}
                className={inputClass}
              />
              <span className="mt-1 block text-xs font-normal text-gray-400">
                Absence fines are created after this.
              </span>
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Icon name="receipt" className="h-4 w-4 text-blue-600" /> Fines
          </legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className={labelClass}>
              Late arrival fine (Rs.)
              <input
                name="late_fine"
                type="number"
                min={1}
                max={10000}
                required
                defaultValue={rules.late_fine_npr}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Unexcused absence fine (Rs.)
              <input
                name="absence_fine"
                type="number"
                min={1}
                max={10000}
                required
                defaultValue={rules.absence_fine_npr}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Absence fines start from
              <input
                name="absence_from"
                type="date"
                required
                min={rules.absence_fines_from < today ? rules.absence_fines_from : today}
                defaultValue={rules.absence_fines_from}
                className={inputClass}
              />
              <span className="mt-1 block text-xs font-normal text-gray-400">
                Never earlier than today: no retroactive fines.
              </span>
            </label>
          </div>
          <p className="text-xs text-gray-500">
            Members avoid the absence fine by tapping “Can’t come” before 9 PM the day before the
            game. The admin can excuse later, with a reason.
          </p>
        </fieldset>

        <p className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs text-gray-600">
          The GPS radius and accuracy limit are set per venue in the <strong>Futsal</strong> tab.
        </p>
        <FormError message={error} />
        <FormSuccess message={saved} />
        <button
          type="submit"
          disabled={update.isPending}
          className={`${primaryButtonClass} sm:w-auto`}
        >
          {update.isPending ? 'Saving…' : 'Save rules'}
        </button>
      </form>
    </Card>
  )
}

/**
 * Monthly fee amounts and payment deadlines. Only months opened / fines created afterwards
 * use the new values; existing due dates never move.
 */
function FeeAmountsCard() {
  const { data: rules } = useClubRules()
  const update = useUpdatePaymentSettings()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  if (!rules) return null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError(null)
    setSaved(null)
    try {
      await update.mutateAsync({
        regular: Number(form.get('regular_fee')),
        partial: Number(form.get('partial_fee')),
        feeDueDays: Number(form.get('fee_due_days')),
        fineDueDays: form.get('fine_due_days') ? Number(form.get('fine_due_days')) : null,
      })
      setSaved(
        'Saved. New amounts and deadlines apply to months opened and fines given from now on.',
      )
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <Card className="max-w-3xl p-6">
      <CardHeader
        title="Payments: fees & deadlines"
        description="Changes apply to months opened and fines given from now on. Existing amounts and due dates never change."
      />
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Regular plan (Rs.)
            <input
              name="regular_fee"
              type="number"
              min={1}
              max={100000}
              required
              defaultValue={rules.regular_fee_npr}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Partial plan (Rs.)
            <input
              name="partial_fee"
              type="number"
              min={1}
              max={100000}
              required
              defaultValue={rules.partial_fee_npr}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Monthly fee due within (days)
            <input
              name="fee_due_days"
              type="number"
              min={1}
              max={90}
              required
              defaultValue={rules.fee_due_days}
              className={inputClass}
            />
            <span className="mt-1 block text-xs font-normal text-gray-400">
              Counted from the open date you choose for each month.
            </span>
          </label>
          <label className={labelClass}>
            Pay fines within (days)
            <input
              name="fine_due_days"
              type="number"
              min={1}
              max={90}
              defaultValue={rules.fine_due_days ?? ''}
              placeholder="No deadline"
              className={inputClass}
            />
            <span className="mt-1 block text-xs font-normal text-gray-400">
              Counted from the day of the fine. Leave empty for no deadline.
            </span>
          </label>
        </div>
        <p className="text-xs text-gray-500">
          Each member’s plan is set on the Members page. Fees may be paid in instalments. A late
          payment shows as Overdue; there is no extra penalty.
        </p>
        <FormError message={error} />
        <FormSuccess message={saved} />
        <button
          type="submit"
          disabled={update.isPending}
          className={`${primaryButtonClass} sm:w-auto`}
        >
          {update.isPending ? 'Saving…' : 'Save payment settings'}
        </button>
      </form>
    </Card>
  )
}
