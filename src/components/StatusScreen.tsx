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
      className="flex min-h-dvh items-center justify-center bg-[#F9FAFB] px-4"
      aria-live="polite"
    >
      <div className="w-full max-w-sm space-y-3 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold text-gray-900">{title}</h1>
        {message && <p className="text-sm text-gray-500">{message}</p>}
        {children && <div>{children}</div>}
      </div>
    </main>
  )
}
