import NextSessionCard from '../features/sessions/NextSessionCard.tsx'

export default function MemberHomePage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Member dashboard</h1>
      <NextSessionCard />
    </section>
  )
}
