import { Link } from 'react-router'
import AuthCard from '../../components/AuthCard.tsx'
import { Icon } from '../../components/icons.tsx'

/**
 * No email is sent (the club pays for nothing). The admin sets a temporary password
 * from the Members page and shares it with the member, who then picks a new one.
 */
export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Forgot your password?">
      <div className="space-y-4 text-sm text-gray-600">
        <p className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
          <Icon name="info" className="h-5 w-5 shrink-0 text-blue-600" />
          <span>
            Ask the team admin. They will give you a temporary password, and you will choose a new
            one the next time you sign in.
          </span>
        </p>
        <p>The app never sends passwords by email or SMS.</p>
      </div>
      <p className="mt-6 text-sm">
        <Link to="/login" className="font-semibold text-blue-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  )
}
