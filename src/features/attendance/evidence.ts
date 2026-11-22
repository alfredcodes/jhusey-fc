/** Short description of how a punch-in was verified. Admin-recorded rows have no GPS. */
export function evidenceText(row: {
  source?: 'gps' | 'admin' | null
  distance_m: number | null
  accuracy_m: number | null
}): string {
  if (row.source === 'admin' || row.distance_m === null || row.accuracy_m === null) {
    return 'Recorded by admin (no GPS)'
  }
  return `${Math.round(row.distance_m)} m away · GPS ±${Math.round(row.accuracy_m)} m`
}
