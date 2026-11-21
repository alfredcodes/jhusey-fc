import { Route, Routes } from 'react-router'
import AdminLayout from './layouts/AdminLayout.tsx'
import MemberLayout from './layouts/MemberLayout.tsx'
import AdminHomePage from './pages/AdminHomePage.tsx'
import LoginPage from './pages/LoginPage.tsx'
import MemberHomePage from './pages/MemberHomePage.tsx'
import NotFoundPage from './pages/NotFoundPage.tsx'

// Route guards arrive with Supabase Auth in Phase 2. They will be UX only:
// PostgreSQL RLS remains the real authorization boundary.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<MemberLayout />}>
        <Route index element={<MemberHomePage />} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminHomePage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
