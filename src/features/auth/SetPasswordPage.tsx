import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import AuthCard, { FormError, inputClass, primaryButtonClass } from '../../components/AuthCard.tsx'
import { supabase } from '../../lib/supabase.ts'

export const MIN_PASSWORD_LENGTH = 8 // keep in sync with supabase/config.toml

type LinkType = 'invite' | 'recovery'

/**
 * Landing page for invite and password-reset emails:
 *   /set-password?token_hash=...&type=invite|recovery
 * The token is only redeemed when the member submits the form, so email
 * link scanners that merely open the page cannot use it up.
 */
export default function SetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const tokenHash = params.get('token_hash')
  const rawType = params.get('type')
  const type: LinkType | null = rawType === 'invite' || rawType === 'recovery' ? rawType : null

  // Set once the token is redeemed, so a failed password update can be retried
  // without redeeming the (now used) token again.
  const verified = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!tokenHash || !type) {
    return (
      <AuthCard title="Link not valid">
        <p className="text-slate-600">
          This link is incomplete. Open the latest email from Jhusey FC, or request a new reset
          link.
        </p>
        <p className="mt-6 text-sm">
          <Link to="/forgot-password" className="font-medium text-emerald-800 underline">
            Request a new link
          </Link>
        </p>
      </AuthCard>
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password'))
    const confirm = String(form.get('confirm'))

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }

    setSubmitting(true)
    setError(null)

    if (!verified.current) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type! })
      if (error) {
        setSubmitting(false)
        setError(
          type === 'invite'
            ? 'This invitation has expired or was already used. Ask the admin to send a new one.'
            : 'This reset link has expired or was already used. Request a new one.',
        )
        return
      }
      verified.current = true
    }

    const { error } = await supabase.auth.updateUser({ password })
    setSubmitting(false)
    if (error) {
      setError(
        error.code === 'weak_password'
          ? 'That password is too weak. Choose a longer one.'
          : error.code === 'same_password'
            ? 'Choose a password different from your current one.'
            : 'Could not save the password. Please try again.',
      )
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <AuthCard title={type === 'invite' ? 'Welcome! Choose a password' : 'Choose a new password'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm font-medium">
          New password
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium">
          Confirm password
          <input
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            className={inputClass}
          />
        </label>
        <FormError message={error} />
        <button type="submit" disabled={submitting} className={primaryButtonClass}>
          {submitting ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </AuthCard>
  )
}
