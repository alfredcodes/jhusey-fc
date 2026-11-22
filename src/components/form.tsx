// Shared form styling and messages (Stitch light theme). Plain Tailwind classes, no UI library.

export const inputClass =
  'mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500'

export const labelClass = 'block text-sm font-medium text-gray-700'

export const primaryButtonClass =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none disabled:opacity-60'

export const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:outline-none disabled:opacity-60'

export const smallButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:outline-none disabled:opacity-60'

export const linkButtonClass =
  'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 disabled:opacity-60'

export const dangerLinkButtonClass =
  'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-60'

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
    >
      {message}
    </p>
  )
}

export function FormSuccess({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p
      role="status"
      className="rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800"
    >
      {message}
    </p>
  )
}
