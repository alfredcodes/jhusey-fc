import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import NepalClock from '../components/NepalClock.tsx'
import { Icon, type IconName } from '../components/icons.tsx'
import { Avatar } from '../components/ui.tsx'
import { formatNpr } from '../lib/format.ts'
import { useProfile } from '../features/auth/use-profile.ts'
import AlertsMenu from '../features/alerts/AlertsMenu.tsx'
import { timeLabel, useClubRules } from '../features/team/queries.ts'
import { supabase } from '../lib/supabase.ts'

type NavItem = { to: string; label: string; icon: IconName; end?: boolean; adminOnly?: boolean }

// One navigation for everyone: members get the same screens read-only; admin-only
// items are hidden for members AND refused by the database.
const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'home', end: true },
  { to: '/attendance', label: 'Attendance Record', icon: 'clipboard' },
  { to: '/sessions', label: 'Sessions', icon: 'calendar' },
  { to: '/fines', label: 'Fines', icon: 'receipt' },
  { to: '/payments', label: 'Payments', icon: 'card' },
  { to: '/members', label: 'Members', icon: 'users' },
  { to: '/reports', label: 'Reports', icon: 'chart' },
  { to: '/history', label: 'My Record', icon: 'history' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
  { to: '/audit', label: 'Audit Log', icon: 'shield', adminOnly: true },
]

function Navigation({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="space-y-1.5">
      {navItems
        .filter((item) => isAdmin || !item.adminOnly)
        .map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-blue-50 font-semibold text-blue-600'
                  : 'font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  name={item.icon}
                  className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
                />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
    </nav>
  )
}

function RulesNote() {
  const { data: rules } = useClubRules()
  if (!rules) return null
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-gray-600">
      <p className="mb-1 flex items-center gap-1.5 font-semibold text-blue-700">
        <Icon name="shield" className="h-4 w-4" /> Club rules
      </p>
      <p>
        On time until {timeLabel(rules.on_time_cutoff)}. Late: {formatNpr(rules.late_fine_npr)}.
        Absent without notice: {formatNpr(rules.absence_fine_npr)}. Tell the team by midnight before
        the session day.
      </p>
    </div>
  )
}

function UserMenu() {
  const { data: profile } = useProfile()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    function onClick(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function signOut() {
    await supabase.auth.signOut()
    // Drop cached data so the next person on this device never sees it.
    queryClient.clear()
    navigate('/login', { replace: true })
  }

  const name = profile?.display_name ?? ''
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2.5 rounded-xl py-1 pr-1 pl-1 hover:bg-gray-50"
      >
        <Avatar name={name || '?'} />
        <span className="hidden flex-col text-left lg:flex">
          <span className="text-sm leading-tight font-semibold text-gray-900">{name}</span>
          <span className="text-xs text-gray-400">
            {profile?.role === 'admin' ? 'Admin' : 'Member'}
          </span>
        </span>
        <Icon name="chevronDown" className="hidden h-4 w-4 text-gray-400 sm:block" />
        <span className="sr-only">Account menu</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-52 rounded-xl border border-gray-100 bg-white p-1.5 shadow-lg"
        >
          <Link
            role="menuitem"
            to="/history"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Icon name="history" className="h-4 w-4 text-gray-400" /> My record
          </Link>
          <Link
            role="menuitem"
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Icon name="settings" className="h-4 w-4 text-gray-400" /> Settings
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
          >
            <Icon name="logout" className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export default function AppLayout() {
  const { data: profile } = useProfile()
  const { data: rules } = useClubRules()
  const isAdmin = profile?.role === 'admin'
  const [drawer, setDrawer] = useState(false)

  return (
    <div className="flex min-h-dvh flex-col bg-[#F9FAFB] text-gray-800">
      <header className="sticky top-0 z-30 w-full border-b border-gray-100 bg-white/95 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:h-20 sm:px-6 lg:px-10">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 md:hidden"
              aria-label="Open menu"
            >
              <Icon name="menu" />
            </button>
            <Link to="/" className="group flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-500 shadow-md shadow-blue-500/20">
                <span className="text-xl font-bold tracking-tighter text-white select-none">
                  J.
                </span>
              </span>
              <span className="flex flex-col">
                <span className="text-base leading-none font-bold tracking-tight text-gray-900 uppercase sm:text-lg">
                  {rules?.club_name ?? 'Jhusey FC'}
                </span>
                <span className="mt-1 hidden text-[11px] font-medium tracking-wider text-gray-400 uppercase sm:block">
                  Futsal Club · Kathmandu
                </span>
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3.5">
            <NepalClock />
            <AlertsMenu />
            <div className="hidden h-6 w-px bg-gray-200 sm:block" />
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-gray-100 bg-white px-4 py-6 md:flex">
          <Navigation isAdmin={isAdmin} />
          <div className="mt-6 border-t border-gray-100 pt-6">
            <RulesNote />
          </div>
        </aside>

        {drawer && (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-gray-900/30"
              onClick={() => setDrawer(false)}
            />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col justify-between overflow-y-auto bg-white px-4 py-5 shadow-xl">
              <div>
                <div className="mb-4 flex items-center justify-between px-2">
                  <span className="text-sm font-bold text-gray-900">Menu</span>
                  <button
                    type="button"
                    onClick={() => setDrawer(false)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
                    aria-label="Close menu"
                  >
                    <Icon name="x" />
                  </button>
                </div>
                <Navigation isAdmin={isAdmin} onNavigate={() => setDrawer(false)} />
              </div>
              <div className="mt-6">
                <RulesNote />
              </div>
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-7xl space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
