import { useEffect, useState } from 'react'
import { formatNepalDate, formatNepalTime } from '../lib/nepal-time.ts'

/** Live Nepal clock. Uses the device clock, so it is for display only. */
export default function NepalClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    // Cleanup stops the timer when the component unmounts (and in StrictMode's dev re-run).
    return () => window.clearInterval(id)
  }, [])

  return (
    <p className="text-right text-xs leading-tight text-slate-300">
      <time dateTime={now.toISOString()} className="block font-mono text-sm text-white">
        {formatNepalTime(now)}
      </time>
      {formatNepalDate(now)} · Nepal time
    </p>
  )
}
