import { describe, expect, it } from 'vitest'
import { summarize, type HistoryRow } from './summary.ts'

function row(result: HistoryRow['result']): HistoryRow {
  return {
    session_id: crypto.randomUUID(),
    session_date: '2026-11-20',
    venue_name: 'Court',
    result,
    original_status: null,
    source: null,
    punched_in_at: null,
    latitude: null,
    longitude: null,
    accuracy_m: null,
    distance_m: null,
    fine_npr: null,
    fine_status: null,
  }
}

describe('summarize', () => {
  it('counts results and the attendance percentage', () => {
    const summary = summarize(
      [row('on_time'), row('on_time'), row('late'), row('absent'), row('open')],
      [],
    )
    expect(summary).toMatchObject({ counted: 4, attended: 3, onTime: 2, late: 1, absent: 1 })
    expect(summary.attendancePercent).toBe(75)
  })

  it('does not count today’s open session yet', () => {
    expect(summarize([row('open')], []).attendancePercent).toBeNull()
  })

  it('totals fines by status', () => {
    const summary = summarize(
      [],
      [
        { amount_npr: 50, status: 'pending' },
        { amount_npr: 50, status: 'pending' },
        { amount_npr: 50, status: 'paid' },
        { amount_npr: 50, status: 'waived' },
      ],
    )
    expect(summary.fines).toEqual({ outstanding: 100, paid: 50, waived: 50 })
  })
})
