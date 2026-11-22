import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import AuthCard from '../../components/AuthCard.tsx'
import { FormError, inputClass, labelClass, primaryButtonClass } from '../../components/form.tsx'
import { supabase } from '../../lib/supabase.ts'
import { useAuth } from './auth-context.ts'

export default function LoginPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) return <Navigate to={from} replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSubmitting(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get('email')).trim(),
      password: String(form.get('password')),
    })

    setSubmitting(false)
    if (error) {
      // Same message for unknown email and wrong password: do not reveal which accounts exist.
      setError(
        error.code === 'invalid_credentials'
          ? 'Email or password is incorrect.'
          : 'Sign-in failed. Please try again in a moment.',
      )
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <AuthCard title="Sign in" subtitle="Welcome back to the squad.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className={labelClass}>
          Email
          <input name="email" type="email" autoComplete="email" required className={inputClass} />
        </label>
        <label className={labelClass}>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </label>
        <FormError message={error} />
        <button type="submit" disabled={submitting} className={primaryButtonClass}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-6 text-sm">
        <Link to="/forgot-password" className="font-semibold text-blue-600 hover:underline">
          Forgot your password?
        </Link>
      </p>
      <p className="mt-2 text-xs text-gray-400">
        Accounts are created by the team admin. There is no public sign-up.
      </p>
    </AuthCard>
  )
}
