// Members sign in with a username (or their phone number used as a username) and a password.
// Supabase Auth needs an email, so a username is stored as `<username>@<MEMBER_LOGIN_DOMAIN>`.
// `.invalid` is a reserved top-level domain (RFC 2606): nothing is ever sent there. Keep this
// constant in sync with supabase/functions/admin-users/index.ts.
export const MEMBER_LOGIN_DOMAIN = 'members.jhusey-fc.invalid'

/** 2–30 characters: lowercase letters, digits, dot, dash, underscore; starts with a letter or digit. */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,29}$/

/** What the member typed (username, phone-as-username or a real email) → the sign-in email. */
export function toLoginEmail(input: string): string {
  const value = input.trim().toLowerCase().replace(/\s+/g, '')
  return value.includes('@') ? value : `${value}@${MEMBER_LOGIN_DOMAIN}`
}

/** The sign-in email → what to show and type: the username, or the real email if there is one. */
export function loginName(email: string | null | undefined): string {
  if (!email) return ''
  const suffix = `@${MEMBER_LOGIN_DOMAIN}`
  return email.endsWith(suffix) ? email.slice(0, -suffix.length) : email
}
