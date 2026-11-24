import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import NepalClock from '../components/NepalClock.tsx'
import { Icon, type IconName } from '../components/icons.tsx'
import { Avatar } from '../components/ui.tsx'
import { formatNpr } from '../lib/format.ts'
import { useProfile } from '../features/auth/use-profile.ts'
import AlertsMenu from '../features/alerts/AlertsMenu.tsx'
import HeaderPunchIn, { MobilePunchInBar } from '../features/attendance/HeaderPunchIn.tsx'
import { timeLabel, useClubRules } from '../features/team/queries.ts'
import { supabase } from '../lib/supabase.ts'

type NavItem = { to: string; label: string; icon: IconName; end?: boolean; adminOnly?: boolean }

// One navigation for everyone: members get the same screens read-only; admin-only
// items are hidden for members AND refused by the database.
// Order follows the dashboard template; "My record" lives in the account menu.
const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'home', end: true },
  { to: '/attendance', label: 'Attendance Record', icon: 'clipboard' },
  { to: '/games', label: 'Futsal Games', icon: 'calendar' },
  { to: '/fines', label: 'Fines', icon: 'receipt' },
  { to: '/fees', label: 'Monthly Fees', icon: 'card' },
  { to: '/members', label: 'Members', icon: 'users' },
  { to: '/reports', label: 'Reports', icon: 'chart' },
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
        Absent without notice: {formatNpr(rules.absence_fine_npr)}. Can’t come? Tell the team before
        9 PM the day before the game.
      </p>
    </div>
  )
}

// Phone/tablet tab bar: the four most-used screens plus "More" for the full menu (drawer).
const tabItems: NavItem[] = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/attendance', label: 'Attendance', icon: 'clipboard' },
  { to: '/games', label: 'Games', icon: 'calendar' },
  { to: '/fines', label: 'Fines', icon: 'receipt' },
]

function tabClass(active: boolean) {
  return `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors select-none active:scale-95 ${
    active ? 'font-semibold text-blue-600' : 'font-medium text-gray-500'
  }`
}

function TabIcon({ name, active }: { name: IconName; active: boolean }) {
  return (
    <span
      className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? 'bg-blue-50' : ''}`}
    >
      <Icon name={name} className="h-5 w-5" />
    </span>
  )
}

function BottomNav({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const { pathname } = useLocation()
  // Screens reached through "More" (Members, Reports, …) highlight the More tab.
  const onTab = tabItems.some((item) =>
    item.end ? pathname === item.to : pathname.startsWith(item.to),
  )
  const moreActive = moreOpen || !onTab
  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_3px_0_rgba(0,0,0,0.04)] backdrop-blur-md xl:hidden"
    >
      <div className="mx-auto flex max-w-xl px-2">
        {tabItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => tabClass(isActive && !moreOpen)}
          >
            {({ isActive }) => (
              <>
                <TabIcon name={item.icon} active={isActive && !moreOpen} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={onMore}
          aria-expanded={moreOpen}
          className={tabClass(moreActive)}
        >
          <TabIcon name="menu" active={moreActive} />
          More
        </button>
      </div>
    </nav>
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
        className="group flex items-center gap-3 rounded-xl py-1 pr-1 pl-1 focus:outline-none"
      >
        <span className="relative">
          <span className="block rounded-full ring-2 ring-transparent transition-all group-hover:ring-blue-500/40">
            <Avatar name={name || '?'} size="lg" />
          </span>
          <span className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
        </span>
        <span className="hidden flex-col text-left lg:flex">
          <span className="text-sm leading-tight font-semibold text-gray-900 transition-colors group-hover:text-blue-600">
            {name}
          </span>
          <span className="text-xs text-gray-400">
            {profile?.role === 'admin' ? 'Admin' : 'Member'}
          </span>
        </span>
        <Icon
          name="chevronDown"
          className="hidden h-4 w-4 text-gray-400 transition-colors group-hover:text-gray-600 sm:block"
        />
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
  const { pathname } = useLocation()

  // Close the drawer on any navigation (including back/forward) and on Escape.
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setDrawer(false)
  }
  useEffect(() => {
    if (!drawer) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setDrawer(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawer])

  return (
    <div className="flex min-h-dvh flex-col bg-[#F9FAFB] text-gray-800">
      <header className="sticky top-0 z-30 w-full border-b pt-[env(safe-area-inset-top)] border-gray-100 bg-white/95 shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_0_rgba(0,0,0,0.02)] backdrop-blur-md">
        <div className="flex h-16 items-center justify-between gap-3 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] sm:px-6 lg:px-10 xl:h-20">
          <div className="flex items-center gap-2">
            <Link to="/" className="group flex items-center gap-3.5 focus:outline-none">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-500 shadow-md shadow-blue-500/20 transition-transform duration-200 group-hover:scale-105">
                <span className="text-xl font-bold tracking-tighter text-white select-none">
                  J.
                </span>
              </span>
              <span className="hidden flex-col min-[420px]:flex">
                <span className="text-base leading-none font-bold tracking-tight text-gray-900 uppercase transition-colors group-hover:text-blue-600 sm:text-lg">
                  {rules?.club_name ?? 'Jhusey FC'}
                </span>
                <span className="mt-1 hidden text-[11px] font-medium tracking-wider text-gray-400 uppercase sm:block">
                  Futsal Club
                </span>
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3.5">
            <span className="hidden sm:block">
              <NepalClock />
            </span>
            <HeaderPunchIn />
            <AlertsMenu />
            <div className="hidden h-6 w-px bg-gray-200 sm:block" />
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="sticky top-20 hidden h-[calc(100dvh-5rem)] w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-gray-100 bg-white px-4 py-6 xl:flex">
          <Navigation isAdmin={isAdmin} />
          <div className="mt-6">
            <RulesNote />
          </div>
        </aside>

        {drawer && (
          <div className="fixed inset-0 z-40 xl:hidden">
            <button
              type="button"
              aria-label="Close menu"
              tabIndex={-1}
              className="absolute inset-0 bg-gray-900/30 backdrop-blur-[2px]"
              onClick={() => setDrawer(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col justify-between overflow-y-auto overscroll-contain bg-white px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl"
            >
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

        {/* Below xl the bottom padding keeps content clear of the fixed tab bar. */}
        <main className="min-w-0 flex-1 px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 lg:px-10 lg:pt-10 xl:pb-10">
          <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6">
            <Outlet />
          </div>
        </main>
      </div>

      <MobilePunchInBar />
      <BottomNav onMore={() => setDrawer((open) => !open)} moreOpen={drawer} />
    </div>
  )
}
