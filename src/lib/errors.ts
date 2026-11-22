/** An error whose message was written for people (e.g. from the admin-users function). */
export class UserFacingError extends Error {}

/** Turns a Supabase/PostgREST error into a message for the user. */
export function errorMessage(error: unknown): string {
  if (error instanceof UserFacingError) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const { code, message } = error as { code?: string; message: string }
    // Messages raised by our own SQL functions (errcode 22023) are written for people.
    if (code === '22023') return message
    if (code === '42501') return 'You do not have permission to do that.'
    if (code === '23505') return 'That already exists.'
    if (code === '23514') return 'One of the values is outside the allowed range.'
  }
  return 'Something went wrong. Please try again.'
}
