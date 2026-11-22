import { useEffect, useState } from 'react'
import { Icon } from './icons.tsx'

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kathmandu',
  weekday: 'long',
  month: 'short',
  day: 'numeric',
})
const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kathmandu',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

/** Live Nepal clock pill. Uses the device clock, so it is for display only. */
export default function NepalClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="flex items-center gap-2 rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 text-gray-600 shadow-sm">
      <Icon name="clock" className="hidden h-3.5 w-3.5 text-gray-400 sm:block" />
      <time dateTime={now.toISOString()} className="flex items-center gap-1.5 text-xs font-medium">
        <span className="hidden text-gray-500 lg:inline">{dayFormatter.format(now)}</span>
        <span className="hidden text-gray-300 lg:inline">•</span>
        <span className="font-semibold tracking-tight whitespace-nowrap text-gray-800">
          {timeFormatter.format(now)}
        </span>
        <span className="rounded bg-blue-50 px-1 py-0.5 text-[10px] font-semibold text-blue-600">
          NPT
        </span>
      </time>
    </div>
  )
}
