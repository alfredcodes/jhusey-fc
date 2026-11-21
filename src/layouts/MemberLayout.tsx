import { Link, Outlet } from 'react-router'
import NepalClock from '../components/NepalClock.tsx'

export default function MemberLayout() {
  return (
    <div className="min-h-dvh">
      <header className="bg-emerald-800 text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="text-lg font-bold tracking-tight">
            Jhusey FC
          </Link>
          <NepalClock />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
