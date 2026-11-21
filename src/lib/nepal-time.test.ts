import { describe, expect, it } from 'vitest'
import {
  addDays,
  formatCalendarDate,
  formatNepalDate,
  formatNepalTime,
  nepalToday,
} from './nepal-time.ts'

describe('nepalToday', () => {
  it('switches date at midnight Nepal time, not UTC midnight', () => {
    // 18:14:59 UTC = 23:59:59 in Kathmandu; one second later it is the next day there.
    expect(nepalToday(new Date('2026-11-21T18:14:59Z'))).toBe('2026-11-21')
    expect(nepalToday(new Date('2026-11-21T18:15:00Z'))).toBe('2026-11-22')
  })
})

describe('addDays', () => {
  it('crosses month and year ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('formatCalendarDate', () => {
  it('formats a date without shifting it', () => {
    expect(formatCalendarDate('2026-11-22')).toBe('Sun, 22 Nov 2026')
  })
})

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
