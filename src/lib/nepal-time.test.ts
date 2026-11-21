import { describe, expect, it } from 'vitest'
import { formatNepalDate, formatNepalTime } from './nepal-time.ts'

describe('formatNepalTime', () => {
  it('converts UTC to Nepal time (UTC+05:45)', () => {
    // 13:30:00 UTC is 19:15:00 in Kathmandu: the attendance cutoff.
    expect(formatNepalTime(new Date('2026-11-21T13:30:00Z'))).toBe('7:15:00 PM')
  })

  it('shows seconds so cutoff boundaries are visible', () => {
    expect(formatNepalTime(new Date('2026-11-21T13:29:59Z'))).toBe('7:14:59 PM')
    expect(formatNepalTime(new Date('2026-11-21T13:30:01Z'))).toBe('7:15:01 PM')
  })

  it('formats morning times with AM', () => {
    expect(formatNepalTime(new Date('2026-11-21T00:15:00Z'))).toBe('6:00:00 AM')
  })
})

describe('formatNepalDate', () => {
  it('uses the Nepal calendar date, not the UTC date', () => {
    // 20:00 UTC on 21 Nov is already 01:45 on 22 Nov in Kathmandu.
    expect(formatNepalDate(new Date('2026-11-21T20:00:00Z'))).toBe('Sun, 22 Nov 2026')
  })
})
