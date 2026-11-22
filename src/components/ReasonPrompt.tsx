import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { errorMessage } from '../lib/errors.ts'
import {
  FormError,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from './form.tsx'
import { Modal } from './ui.tsx'

/**
 * Confirmation dialog that asks for a reason (stored in the audit log).
 * `onConfirm` receives the reason; throw to show an error, resolve to close.
 */
export default function ReasonPrompt({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  children,
}: {
  title: string
  description?: ReactNode
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
      onCancel()
    } catch (caught) {
      setError(errorMessage(caught))
      setBusy(false)
    }
  }

  return (
    <Modal title={title} description={description} onClose={onCancel}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {children}
        <div>
          <label htmlFor={id} className={labelClass}>
            Reason (saved in the audit log)
          </label>
          <input
            id={id}
            name="reason"
            required
            minLength={3}
            maxLength={300}
            className={inputClass}
          />
        </div>
        <FormError message={error} />
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className={primaryButtonClass}>
            {busy ? 'Saving…' : confirmLabel}
          </button>
          <button type="button" onClick={onCancel} className={secondaryButtonClass}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
