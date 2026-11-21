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
