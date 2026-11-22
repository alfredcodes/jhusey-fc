import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { errorMessage } from '../lib/errors.ts'
import { FormError, inputClass, smallButtonClass } from './form.tsx'

/**
 * Inline confirmation that asks for a reason (stored in the audit log).
 * `onConfirm` receives the reason; throw to show an error.
 */
export default function ReasonPrompt({
  title,
  confirmLabel,
  onConfirm,
  onCancel,
  children,
}: {
  title: string
  confirmLabel: string
  onConfirm: (reason: string) => Promise<unknown>
  onCancel: () => void
  children?: ReactNode
}) {
  const id = useId()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError(null)
    try {
      await onConfirm(String(form.get('reason')).trim())
    } catch (caught) {
      setError(errorMessage(caught))
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3"
    >
      <p className="text-sm font-semibold">{title}</p>
      {children}
      <label htmlFor={id} className="block text-sm font-medium">
        Reason (saved in the audit log)
      </label>
      <input id={id} name="reason" required minLength={3} maxLength={300} className={inputClass} />
      <FormError message={error} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className={`${smallButtonClass} border-amber-600 bg-amber-600 text-white hover:bg-amber-700`}
        >
          {busy ? 'Saving…' : confirmLabel}
        </button>
        <button type="button" onClick={onCancel} className={smallButtonClass}>
          Cancel
        </button>
      </div>
    </form>
  )
}
