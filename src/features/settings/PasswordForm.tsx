import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import {
  FormError,
  FormSuccess,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '../../components/form.tsx'
import { supabase } from '../../lib/supabase.ts'
import { useAuth } from '../auth/auth-context.ts'

export const MIN_PASSWORD_LENGTH = 8

/**
 * Change the signed-in user's password. With `requireCurrent`, the current password is
 * checked first (Settings). The forced first-login screen skips it: the member has just
 * signed in with the password the admin gave them.
 */
export default function PasswordForm({
  requireCurrent,
  onChanged,
}: {
  requireCurrent: boolean
  onChanged?: () => void
}) {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const next = String(form.get('password'))
    setError(null)
    setDone(null)
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (next !== String(form.get('confirm'))) {
      setError('The two new passwords do not match.')
      return
    }
    setBusy(true)
    try {
      if (requireCurrent) {
        const email = session?.user.email
        const check = email
          ? await supabase.auth.signInWithPassword({ email, password: String(form.get('current')) })
          : { error: new Error('no email') }
        if (check.error) {
          setError('Your current password is not correct.')
          return
        }
        if (String(form.get('current')) === next) {
          setError('Choose a password different from the current one.')
          return
        }
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: next })
      if (updateError) {
        setError(
          updateError.code === 'same_password'
            ? 'Choose a password different from the current one.'
            : updateError.code === 'weak_password'
              ? 'That password is too weak. Try a longer one.'
              : 'Could not change the password. Please try again.',
        )
        return
      }
      await supabase.rpc('mark_password_changed')
      await queryClient.invalidateQueries({ queryKey: ['member_private'] })
      formElement.reset()
      setDone('Password changed.')
      onChanged?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {requireCurrent && (
        <label className={labelClass}>
          Current password
          <input
            name="current"
            type="password"
            required
            autoComplete="current-password"
            className={inputClass}
          />
        </label>
      )}
      <label className={labelClass}>
        New password
        <input
          name="password"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          className={inputClass}
        />
        <span className="mt-1 block text-xs font-normal text-gray-400">
          At least {MIN_PASSWORD_LENGTH} characters. A short sentence is easy to remember.
        </span>
      </label>
      <label className={labelClass}>
        Confirm new password
        <input
          name="confirm"
          type="password"
          required
          autoComplete="new-password"
          className={inputClass}
        />
      </label>
      <FormError message={error} />
      <FormSuccess message={done} />
      <button type="submit" disabled={busy} className={`${primaryButtonClass} sm:w-auto`}>
        {busy ? 'Saving…' : 'Update password'}
      </button>
    </form>
  )
}
