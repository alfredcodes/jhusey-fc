import { Link, NavLink, Outlet } from 'react-router'
import NepalClock from '../components/NepalClock.tsx'
import SignOutButton from '../features/auth/SignOutButton.tsx'
import { useProfile } from '../features/auth/use-profile.ts'

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/history', label: 'My attendance', end: false },
  { to: '/team', label: 'Team', end: false },
]

export default function MemberLayout() {
  const { data: profile } = useProfile()

  return (
    <div className="min-h-dvh">
      <header className="bg-emerald-800 text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="text-lg font-bold tracking-tight">
            Jhusey FC
          </Link>
          <NepalClock />
        </div>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pb-2 text-sm">
          <span className="truncate">{profile?.display_name}</span>
          <span className="flex items-center gap-3">
            {profile?.role === 'admin' && (
              <Link to="/admin" className="font-medium underline">
                Admin
              </Link>
            )}
            <SignOutButton />
          </span>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 px-4 pb-3 text-sm" aria-label="Member">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-1 font-medium ${isActive ? 'bg-white text-emerald-900' : 'hover:bg-emerald-700'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
