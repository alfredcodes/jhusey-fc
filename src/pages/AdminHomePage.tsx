import { Link } from 'react-router'
import AdminTodayAttendance from '../features/attendance/AdminTodayAttendance.tsx'
import NextSessionCard from '../features/sessions/NextSessionCard.tsx'

const sections = [
  {
    to: '/admin/sessions',
    title: 'Sessions',
    text: 'Create the calendar, cancel or restore dates.',
  },
  { to: '/admin/venues', title: 'Venues', text: 'Court location and punch-in radius.' },
]

export default function AdminHomePage() {
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin dashboard</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.to}
            to={section.to}
            className="rounded-lg border border-slate-200 bg-white p-4 hover:border-emerald-700"
          >
            <p className="font-semibold">{section.title}</p>
            <p className="text-sm text-slate-600">{section.text}</p>
          </Link>
        ))}
      </div>
      <AdminTodayAttendance />
      <NextSessionCard />
    </section>
  )
}
