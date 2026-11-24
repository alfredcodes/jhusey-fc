import type { ReactNode } from 'react'
import CourtBackdrop from './CourtBackdrop.tsx'

/** Shared frame for the public sign-in pages. */
export default function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center bg-blue-900 px-4 py-10">
      <CourtBackdrop />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3.5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-blue-500 to-indigo-400 shadow-lg ring-1 shadow-blue-950/40 ring-white/25">
            <span className="text-xl font-bold tracking-tighter text-white select-none">J.</span>
          </span>
          <span className="flex flex-col">
            <span className="text-lg leading-none font-bold tracking-tight text-white">
              JHUSEY FC
            </span>
            <span className="mt-1 text-[11px] font-medium tracking-wider text-blue-100/80 uppercase">
              Futsal Club · Kathmandu
            </span>
          </span>
        </div>
        <div className="rounded-2xl border border-white/60 bg-white p-6 shadow-2xl shadow-blue-950/40 sm:p-7">
          <h1 className="text-xl font-bold tracking-tight text-gray-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  )
}
