import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import AuthCard from '../../components/AuthCard.tsx'
import { FormError, inputClass, primaryButtonClass } from '../../components/form.tsx'
import { supabase } from '../../lib/supabase.ts'

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email')).trim()
    setSubmitting(true)
    setError(null)

    // The recovery email template builds the /set-password link itself.
    const { error } = await supabase.auth.resetPasswordForEmail(email)

    setSubmitting(false)
    if (error && error.status === 429) {
      setError('Too many requests. Please wait a few minutes and try again.')
      return
    }
    // Shown whether or not the email exists, so the form cannot be used to discover accounts.
    setSent(true)
  }

  return (
    <AuthCard title="Reset your password">
      {sent ? (
        <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-emerald-900">
          If an account exists for that email, a reset link is on its way. Check your inbox.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium">
            Email
            <input name="email" type="email" autoComplete="email" required className={inputClass} />
          </label>
          <FormError message={error} />
          <button type="submit" disabled={submitting} className={primaryButtonClass}>
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
      <p className="mt-6 text-sm">
        <Link to="/login" className="font-medium text-emerald-800 underline">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  )
}
