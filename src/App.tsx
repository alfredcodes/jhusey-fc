import { Route, Routes } from 'react-router'
import ForgotPasswordPage from './features/auth/ForgotPasswordPage.tsx'
import LoginPage from './features/auth/LoginPage.tsx'
import RequireAdmin from './features/auth/RequireAdmin.tsx'
import RequireAuth from './features/auth/RequireAuth.tsx'
import SetPasswordPage from './features/auth/SetPasswordPage.tsx'
import AdminAttendancePage from './features/admin/AdminAttendancePage.tsx'
import AdminAuditPage from './features/admin/AdminAuditPage.tsx'
import AdminFinesPage from './features/admin/AdminFinesPage.tsx'
import AdminMembersPage from './features/admin/AdminMembersPage.tsx'
import HistoryPage from './features/history/HistoryPage.tsx'
import TeamPage from './features/history/TeamPage.tsx'
import AdminSessionsPage from './features/sessions/AdminSessionsPage.tsx'
import AdminVenuesPage from './features/sessions/AdminVenuesPage.tsx'
import AdminLayout from './layouts/AdminLayout.tsx'
import MemberLayout from './layouts/MemberLayout.tsx'
import AdminHomePage from './pages/AdminHomePage.tsx'
import MemberHomePage from './pages/MemberHomePage.tsx'
import NotFoundPage from './pages/NotFoundPage.tsx'

// Route guards are UX only. PostgreSQL RLS is the real authorization boundary.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<MemberLayout />}>
          <Route index element={<MemberHomePage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="team" element={<TeamPage />} />
        </Route>

        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminHomePage />} />
            <Route path="attendance" element={<AdminAttendancePage />} />
            <Route path="fines" element={<AdminFinesPage />} />
            <Route path="members" element={<AdminMembersPage />} />
            <Route path="audit" element={<AdminAuditPage />} />
            <Route path="sessions" element={<AdminSessionsPage />} />
            <Route path="venues" element={<AdminVenuesPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
