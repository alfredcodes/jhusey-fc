/** One session from my_session_history(). Punch-in fields are null on absent/open days. */
export type HistoryRow = {
  session_id: string
  session_date: string
  venue_name: string
  result: 'on_time' | 'late' | 'absent' | 'open'
  /** First result at punch-in; differs from result when the admin corrected it. */
  original_status: 'on_time' | 'late' | null
  source: 'gps' | 'admin' | null
  punched_in_at: string | null
  latitude: number | null
  longitude: number | null
  accuracy_m: number | null
  distance_m: number | null
  fine_npr: number | null
  fine_status: 'pending' | 'paid' | 'waived' | null
}

export type FineRow = { amount_npr: number; status: 'pending' | 'paid' | 'waived' }

export type Summary = {
  /** Closed sessions since joining (today's open session is not counted yet). */
  counted: number
  attended: number
  onTime: number
  late: number
  absent: number
  /** Whole-number percentage of counted sessions attended, or null before the first one. */
  attendancePercent: number | null
  fines: { outstanding: number; paid: number; waived: number }
}

export function summarize(rows: HistoryRow[], fines: FineRow[]): Summary {
  const count = (result: HistoryRow['result']) => rows.filter((row) => row.result === result).length
  const onTime = count('on_time')
  const late = count('late')
  const absent = count('absent')
  const attended = onTime + late
  const counted = attended + absent
  const sum = (status: FineRow['status']) =>
    fines
      .filter((fine) => fine.status === status)
      .reduce((total, fine) => total + fine.amount_npr, 0)

  return {
    counted,
    attended,
    onTime,
    late,
    absent,
    attendancePercent: counted === 0 ? null : Math.round((attended / counted) * 100),
    fines: { outstanding: sum('pending'), paid: sum('paid'), waived: sum('waived') },
  }
}
