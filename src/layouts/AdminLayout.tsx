import { Link, Outlet } from 'react-router'
import NepalClock from '../components/NepalClock.tsx'

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
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
