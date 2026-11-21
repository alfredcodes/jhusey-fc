import { Link, Outlet } from 'react-router'
import NepalClock from '../components/NepalClock.tsx'
import SignOutButton from '../features/auth/SignOutButton.tsx'

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
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3 px-4 pb-3 text-sm">
          <Link to="/" className="font-medium underline">
            Member view
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
