import { Navigate, Outlet } from 'react-router'
import { useProfile } from './use-profile.ts'

/** Must be nested inside <RequireAuth>, which has already loaded an active profile. */
export default function RequireAdmin() {
  const profile = useProfile()
  if (profile.data?.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}
