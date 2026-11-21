import type { ReactNode } from 'react'

/** Shared frame for the public sign-in pages. */
export default function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-8">
      <p className="text-lg font-bold text-emerald-800">Jhusey FC</p>
      <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
      <div className="mt-6">{children}</div>
    </main>
  )
}

export const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/30 focus:outline-none'

export const primaryButtonClass =
  'w-full rounded-md bg-emerald-800 px-4 py-2.5 font-semibold text-white hover:bg-emerald-900 disabled:opacity-60'

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </p>
  )
}
