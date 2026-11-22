import { Navigate, Outlet } from 'react-router'
import { useProfile } from './use-profile.ts'

/** UX guard for admin-only pages. The database refuses members anyway. */
export default function RequireAdmin() {
  const { data: profile } = useProfile()
  if (profile?.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}
