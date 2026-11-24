import { nepalToday } from '../../lib/nepal-time.ts'

/** An unpaid fine past its due date (set from Settings → Rules when the fine was given). */
export function fineOverdue(fine: { status: string; due_on: string | null }) {
  return fine.status === 'pending' && fine.due_on !== null && fine.due_on < nepalToday()
}
