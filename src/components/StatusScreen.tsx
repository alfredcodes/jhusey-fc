import type { ReactNode } from 'react'

/** Full-screen message for loading, error and blocked states. */
export default function StatusScreen({
  title,
  message,
  children,
}: {
  title: string
  message?: string
  children?: ReactNode
}) {
  return (
    <main
      className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-3 px-4"
      aria-live="polite"
    >
      <h1 className="text-xl font-semibold">{title}</h1>
      {message && <p className="text-slate-600">{message}</p>}
      {children && <div>{children}</div>}
    </main>
  )
}
