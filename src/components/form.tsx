// Shared form styling and messages. Plain Tailwind classes, no component library.

export const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/30 focus:outline-none'

export const primaryButtonClass =
  'w-full rounded-md bg-emerald-800 px-4 py-2.5 font-semibold text-white hover:bg-emerald-900 disabled:opacity-60'

export const smallButtonClass =
  'rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium hover:bg-slate-100 disabled:opacity-60'

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </p>
  )
}

export function FormSuccess({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
      {message}
    </p>
  )
}
