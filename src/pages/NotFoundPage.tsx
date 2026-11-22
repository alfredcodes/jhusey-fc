import { Link } from 'react-router'
import StatusScreen from '../components/StatusScreen.tsx'

export default function NotFoundPage() {
  return (
    <StatusScreen title="Page not found" message="That page does not exist.">
      <Link to="/" className="text-sm font-semibold text-blue-600 hover:underline">
        Back to dashboard
      </Link>
    </StatusScreen>
  )
}
