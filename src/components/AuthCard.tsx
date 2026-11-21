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
