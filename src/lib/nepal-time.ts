// Display-only helpers for Asia/Kathmandu (UTC+05:45, no daylight saving).
// Never use these to decide On Time / Late: attendance status comes from the server.

export const NEPAL_TIME_ZONE = 'Asia/Kathmandu'

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: NEPAL_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
})

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: NEPAL_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** Formats an instant as Nepal wall-clock time, e.g. "7:15:00 PM". */
export function formatNepalTime(instant: Date): string {
  // formatToParts gives a stable result; plain format() output varies between
  // ICU versions (some insert a narrow no-break space before "PM").
  const parts = timeFormatter.formatToParts(instant)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${get('hour')}:${get('minute')}:${get('second')} ${get('dayPeriod').toUpperCase()}`
}

/** Formats an instant as a Nepal calendar date, e.g. "Sat, 21 Nov 2026". */
export function formatNepalDate(instant: Date): string {
  return dateFormatter.format(instant)
}

// en-CA formats dates as YYYY-MM-DD, the same shape PostgreSQL `date` values arrive in.
const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: NEPAL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Today's Nepal date as "YYYY-MM-DD". Display/filtering only; the database decides for punch-in. */
export function nepalToday(instant: Date = new Date()): string {
  return isoDateFormatter.format(instant)
}

/** Adds whole days to a "YYYY-MM-DD" date. */
export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

const sessionDateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/**
 * Formats a calendar date ("YYYY-MM-DD") such as a session date, e.g. "Sun, 22 Nov 2026".
 * A date has no time zone, so it is formatted in UTC to stop it shifting by a day.
 */
export function formatCalendarDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return sessionDateFormatter.format(new Date(Date.UTC(year, month - 1, day)))
}

const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: NEPAL_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** "Can't come" closes at this Nepal time on the day before the game. The database enforces it. */
export const ABSENCE_NOTICE_CUTOFF = '21:00:00'

/** Whether members may still give or withdraw a "Can't come" notice. UI hint only. */
export function absenceNoticeOpen(sessionDate: string, instant: Date = new Date()): boolean {
  const today = nepalToday(instant)
  const dayBefore = addDays(sessionDate, -1)
  if (today < dayBefore) return true
  return today === dayBefore && clockFormatter.format(instant) < ABSENCE_NOTICE_CUTOFF
}
