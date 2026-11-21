import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="mt-4 font-medium text-emerald-700 underline">
        Back to dashboard
      </Link>
    </main>
  )
}
