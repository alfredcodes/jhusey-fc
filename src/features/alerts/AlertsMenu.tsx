// In-app notifications, built from the member's own data. Free: no push, SMS or email.
// "Unread" is remembered per device in localStorage (a convenience only).
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Icon, type IconName } from '../../components/icons.tsx'
import { formatNpr } from '../../lib/format.ts'
import { addDays, formatCalendarDate, nepalToday } from '../../lib/nepal-time.ts'
import { supabase } from '../../lib/supabase.ts'
import { useAuth } from '../auth/auth-context.ts'
import { useMySubmissions, usePendingSubmissions } from '../fees/submissions.ts'
import { useProfile } from '../auth/use-profile.ts'
import {
  timeLabel,
  useClubRules,
  useIsAdmin,
  useMyConfirmations,
  useMyExcuses,
} from '../team/queries.ts'

const SEEN_KEY = 'jfc.alertsSeenAt'

type Alert = { id: string; at: string; icon: IconName; tone: string; text: string; to: string }

function readSeen() {
  try {
    return localStorage.getItem(SEEN_KEY) ?? ''
  } catch {
    return ''
  }
}

function useAlerts(): Alert[] {
  const { session } = useAuth()
  const userId = session?.user.id
  const { data: rules } = useClubRules()
  const excuses = useMyExcuses()
  const confirmations = useMyConfirmations()
  const { data: profile } = useProfile()
  const partial = profile?.fee_plan === 'partial'
  const isAdmin = useIsAdmin()
  const pending = usePendingSubmissions(isAdmin)
  const mySubmissions = useMySubmissions()
  const today = nepalToday()

  const fines = useQuery({
    queryKey: ['fines', 'alerts', userId],
    enabled: userId !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fines')
        .select('id, reason, amount_npr, status, updated_at, session:sessions(session_date)')
        .eq('member_id', userId!)
        .gte('updated_at', new Date(Date.now() - 30 * 86_400_000).toISOString())
        .order('updated_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data
    },
  })

  const sessions = useQuery({
    queryKey: ['sessions', 'alerts', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, session_date, status')
        .gte('session_date', today)
        .lte('session_date', addDays(today, 1))
        .order('session_date')
      if (error) throw error
      return data
    },
  })

  const alerts: Alert[] = []

  // Monthly fee submissions: the admin hears about new ones, the member about the decision.
  const pendingRows = pending.data ?? []
  if (pendingRows.length > 0) {
    const latest = pendingRows[pendingRows.length - 1]
    alerts.push({
      id: `p-pending-${latest.id}`,
      at: latest.created_at,
      icon: 'cash',
      tone: 'text-amber-600',
      text: `${pendingRows.length} payment submission${pendingRows.length === 1 ? '' : 's'} waiting for your approval (latest: ${latest.member?.display_name}).`,
      to: '/fees',
    })
  }
  const monthAgo = addDays(today, -30) // ISO timestamps compare correctly with a date
  for (const submission of mySubmissions.data ?? []) {
    if (submission.status === 'pending' || !submission.reviewed_at) continue
    if (submission.reviewed_at < monthAgo) continue
    const approved = submission.status === 'approved'
    alerts.push({
      id: `p-${submission.id}-${submission.status}`,
      at: submission.reviewed_at,
      icon: approved ? 'checkCircle' : 'warning',
      tone: approved ? 'text-emerald-600' : 'text-rose-600',
      text: approved
        ? `Your ${formatNpr(submission.amount_npr)} fee payment was approved.`
        : `Your ${formatNpr(submission.amount_npr)} fee payment was rejected${submission.review_note ? `: ${submission.review_note}` : '.'}`,
      to: '/fees',
    })
  }
  for (const session of sessions.data ?? []) {
    const excused = excuses.data?.some((excuse) => excuse.session_id === session.id)
    if (session.status === 'cancelled') {
      alerts.push({
        id: `s-${session.id}`,
        at: `${session.session_date}T00:00:00`,
        icon: 'ban',
        tone: 'text-gray-500',
        text: `${session.session_date === today ? 'Today' : 'Tomorrow'}'s session is cancelled.`,
        to: '/games',
      })
    } else if (session.session_date === today) {
      alerts.push({
        id: `s-${session.id}`,
        at: `${session.session_date}T00:00:00`,
        icon: 'calendar',
        tone: 'text-blue-600',
        text: excused
          ? 'Session today: you told the team you cannot come.'
          : `Session today. Punch in from ${timeLabel(rules?.punch_open)}, on time until ${timeLabel(rules?.on_time_cutoff)}.`,
        to: '/',
      })
    } else if (!excused && partial) {
      // Partial players are expected only at games they confirm.
      const confirmed = confirmations.data?.some((row) => row.session_id === session.id)
      alerts.push({
        id: `s-${session.id}`,
        at: `${session.session_date}T00:00:00`,
        icon: 'calendar',
        tone: 'text-blue-600',
        text: confirmed
          ? 'Session tomorrow: you said you’re coming.'
          : 'Session tomorrow. Coming? Tap I’m coming before 9 PM.',
        to: '/games',
      })
    } else if (!excused) {
      alerts.push({
        id: `s-${session.id}`,
        at: `${session.session_date}T00:00:00`,
        icon: 'calendar',
        tone: 'text-blue-600',
        text: "Game tomorrow. Can't come? Tell the team before 9 PM today.",
        to: '/games',
      })
    }
  }
  for (const fine of fines.data ?? []) {
    const what = fine.reason === 'late' ? 'Late fine' : 'Absence fine'
    const date = fine.session ? ` (${formatCalendarDate(fine.session.session_date)})` : ''
    const text =
      fine.status === 'paid'
        ? `${what} of ${formatNpr(fine.amount_npr)}${date} marked paid.`
        : fine.status === 'waived'
          ? `${what} of ${formatNpr(fine.amount_npr)}${date} was waived.`
          : `New ${what.toLowerCase()}: ${formatNpr(fine.amount_npr)}${date}.`
    alerts.push({
      id: `f-${fine.id}-${fine.status}`,
      at: fine.updated_at,
      icon: fine.status === 'pending' ? 'receipt' : 'checkCircle',
      tone: fine.status === 'pending' ? 'text-amber-600' : 'text-emerald-600',
      text,
      to: '/history',
    })
  }
  return alerts
}

export default function AlertsMenu() {
  const alerts = useAlerts()
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(readSeen)
  const ref = useRef<HTMLDivElement>(null)
  const unread = alerts.filter(
    (alert) => (alert.id.startsWith('f-') || alert.id.startsWith('p-')) && alert.at > seen,
  ).length

  useEffect(() => {
    if (!open) return
    function onClick(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  function toggle() {
    const next = !open
    setOpen(next)
    if (next) {
      const now = new Date().toISOString()
      setSeen(now)
      try {
        localStorage.setItem(SEEN_KEY, now)
      } catch {
        // Storage unavailable (private mode): the badge just reappears next visit.
      }
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'}
        className="relative rounded-full p-2.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
      >
        <Icon name="bell" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] leading-none font-bold text-white ring-2 ring-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-100 bg-white p-2 shadow-lg">
          <p className="px-3 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
            Notifications
          </p>
          {alerts.length === 0 ? (
            <p className="px-3 pb-3 text-sm text-gray-500">Nothing new.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <Link
                    to={alert.to}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Icon name={alert.icon} className={`mt-0.5 h-4 w-4 shrink-0 ${alert.tone}`} />
                    <span>{alert.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
