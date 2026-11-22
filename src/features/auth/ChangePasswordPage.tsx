import { useNavigate } from 'react-router'
import AuthCard from '../../components/AuthCard.tsx'
import PasswordForm from '../settings/PasswordForm.tsx'
import SignOutButton from './SignOutButton.tsx'

/** Shown after signing in with a password the admin set (new account or reset). */
export default function ChangePasswordPage() {
  const navigate = useNavigate()
  return (
    <AuthCard
      title="Choose your own password"
      subtitle="You signed in with a password from the admin. Pick a new one that only you know."
    >
      <PasswordForm requireCurrent={false} onChanged={() => navigate('/', { replace: true })} />
      <div className="mt-6 border-t border-gray-100 pt-4">
        <SignOutButton />
      </div>
    </AuthCard>
  )
}
