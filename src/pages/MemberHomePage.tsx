import PunchInCard from '../features/attendance/PunchInCard.tsx'
import MemberStats from '../features/history/MemberStats.tsx'
import NextSessionCard from '../features/sessions/NextSessionCard.tsx'
import { useUpcomingSessions } from '../features/sessions/queries.ts'
import { nepalToday } from '../lib/nepal-time.ts'

export default function MemberHomePage() {
  // Same query (and cache) as NextSessionCard, so this costs no extra request.
  const sessions = useUpcomingSessions(10)
  const today = sessions.data?.find(
    (session) => session.session_date === nepalToday() && session.status === 'scheduled',
  )

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Member dashboard</h1>
      {today && <PunchInCard sessionId={today.id} venueName={today.venue?.name ?? 'the venue'} />}
      <MemberStats />
      <NextSessionCard />
    </section>
  )
}
