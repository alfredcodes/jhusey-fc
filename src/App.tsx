import { Route, Routes } from 'react-router'
import ForgotPasswordPage from './features/auth/ForgotPasswordPage.tsx'
import LoginPage from './features/auth/LoginPage.tsx'
import RequireAdmin from './features/auth/RequireAdmin.tsx'
import RequireAuth from './features/auth/RequireAuth.tsx'
import SetPasswordPage from './features/auth/SetPasswordPage.tsx'
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
        </Route>

        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminHomePage />} />
            <Route path="sessions" element={<AdminSessionsPage />} />
            <Route path="venues" element={<AdminVenuesPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
