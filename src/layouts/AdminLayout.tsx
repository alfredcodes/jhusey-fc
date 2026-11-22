import { Link, NavLink, Outlet } from 'react-router'
import NepalClock from '../components/NepalClock.tsx'
import SignOutButton from '../features/auth/SignOutButton.tsx'

const navItems = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/attendance', label: 'Attendance', end: false },
  { to: '/admin/fines', label: 'Fines', end: false },
  { to: '/admin/members', label: 'Members', end: false },
  { to: '/admin/reports', label: 'Reports', end: false },
  { to: '/admin/sessions', label: 'Sessions', end: false },
  { to: '/admin/venues', label: 'Venues', end: false },
  { to: '/admin/audit', label: 'Audit', end: false },
]

export default function AdminLayout() {
  return (
    <div className="min-h-dvh">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/admin" className="text-lg font-bold tracking-tight">
            Jhusey FC <span className="font-normal text-slate-300">Admin</span>
          </Link>
          <NepalClock />
        </div>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 pb-3 text-sm">
          <nav className="flex flex-wrap gap-1" aria-label="Admin">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1 font-medium ${isActive ? 'bg-white text-slate-900' : 'hover:bg-slate-700'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <span className="flex items-center gap-3">
            <Link to="/" className="font-medium underline">
              Member view
            </Link>
            <SignOutButton />
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
