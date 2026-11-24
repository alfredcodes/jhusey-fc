import { Navigate, Route, Routes } from 'react-router'
import AuditPage from './features/admin/AuditPage.tsx'
import AttendancePage from './features/attendance/AttendancePage.tsx'
import ChangePasswordPage from './features/auth/ChangePasswordPage.tsx'
import ForgotPasswordPage from './features/auth/ForgotPasswordPage.tsx'
import LoginPage from './features/auth/LoginPage.tsx'
import RequireAdmin from './features/auth/RequireAdmin.tsx'
import RequireAuth from './features/auth/RequireAuth.tsx'
import FeesPage from './features/fees/FeesPage.tsx'
import FinesPage from './features/fines/FinesPage.tsx'
import HistoryPage from './features/history/HistoryPage.tsx'
import MembersPage from './features/members/MembersPage.tsx'
import ReportsPage from './features/reports/ReportsPage.tsx'
import SessionsPage from './features/sessions/SessionsPage.tsx'
import SettingsPage from './features/settings/SettingsPage.tsx'
import AppLayout from './layouts/AppLayout.tsx'
import DashboardPage from './pages/DashboardPage.tsx'
import NotFoundPage from './pages/NotFoundPage.tsx'

// Members and the admin share the same screens; admin controls are hidden for members.
// Route guards are UX only. PostgreSQL RLS and the RPC checks are the real boundary.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="games" element={<SessionsPage />} />
          <Route path="sessions" element={<Navigate to="/games" replace />} />
          <Route path="fines" element={<FinesPage />} />
          <Route path="fees" element={<FeesPage />} />
          {/* Fine payments moved under Fines; monthly fees have their own page. */}
          <Route path="payments" element={<Navigate to="/fines?tab=payments" replace />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route element={<RequireAdmin />}>
            <Route path="audit" element={<AuditPage />} />
          </Route>
          {/* Old admin links from before the redesign. */}
          <Route path="admin/*" element={<Navigate to="/" replace />} />
          <Route path="team" element={<Navigate to="/attendance" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
