import { Navigate, Outlet, useLocation } from 'react-router'
import StatusScreen from '../../components/StatusScreen.tsx'
import { useAuth } from './auth-context.ts'
import SignOutButton from './SignOutButton.tsx'
import { useMyPrivate } from './use-private.ts'
import { useProfile } from './use-profile.ts'

/**
 * Route guard for signed-in pages. This is user experience only:
 * PostgreSQL RLS decides what data a user can actually read or change.
 */
export default function RequireAuth() {
  const { session, loading } = useAuth()
  const profile = useProfile()
  const mine = useMyPrivate()
  const location = useLocation()

  if (loading) return <StatusScreen title="Loading…" />

  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  if (profile.isPending || mine.isPending) return <StatusScreen title="Loading your profile…" />

  if (profile.isError) {
    return (
      <StatusScreen
        title="Could not load your profile"
        message="Check your connection and try again."
      >
        <SignOutButton />
      </StatusScreen>
    )
  }

  if (!profile.data.is_active) {
    return (
      <StatusScreen
        title="Account deactivated"
        message="Your Jhusey FC account is not active. Contact the team admin."
      >
        <SignOutButton />
      </StatusScreen>
    )
  }

  // A password set by the admin (new account or reset) must be replaced first.
  if (mine.data?.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  return <Outlet />
}
