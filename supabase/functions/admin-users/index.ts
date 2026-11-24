// Admin-only account management. Runs on Supabase Edge Functions (free tier).
//
//   POST { action: 'create', username (or email), password, display_name, phone? }
//   POST { action: 'reset_password', member_id, password }
//   POST { action: 'delete', member_id, reason }   (keeps all history; locks the login)
//
// Why a function: creating users and setting another user's password need the
// service-role key, which must never reach the browser. This function:
//   * checks the caller's session and that they are the active admin;
//   * never logs, stores or returns a password (Supabase Auth stores only a hash);
//   * flags the member to change the password at next sign-in;
//   * writes the audit log;
//   * deletes the new login again if the follow-up step fails, so nothing is half-created.
import { createClient } from 'npm:@supabase/supabase-js@2.119.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Members sign in with a username, stored as <username>@MEMBER_LOGIN_DOMAIN (a reserved,
// undeliverable domain). Keep in sync with src/lib/login-name.ts.
const MEMBER_LOGIN_DOMAIN = 'members.jhusey-fc.invalid'
const USERNAME = /^[a-z0-9][a-z0-9._-]{1,29}$/
const PHONE = /^\+?[0-9 ]{7,20}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const fail = (status: number, error: string) => reply(status, { error })

function checkPassword(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 8)
    return 'The password needs at least 8 characters.'
  if (value.length > 72) return 'Keep the password under 72 characters.'
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return fail(405, 'Method not allowed.')

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // 1. Who is calling? Only the active admin may continue.
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return fail(401, 'Sign in again.')
  const { data: caller, error: callerError } = await admin.auth.getUser(token)
  if (callerError || !caller.user) return fail(401, 'Sign in again.')
  const { data: profile } = await admin
    .from('profiles')
    .select('role, is_active')
    .eq('id', caller.user.id)
    .maybeSingle()
  if (profile?.role !== 'admin' || !profile.is_active)
    return fail(403, 'Only the admin can do this.')

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail(400, 'Bad request.')
  }

  const audit = (action: string, entityId: string, details: Record<string, unknown>) =>
    admin.from('audit_log').insert({
      actor_id: caller.user.id,
      action,
      entity: 'profile',
      entity_id: entityId,
      details,
    })

  // 2. Create a member with an initial password.
  if (body.action === 'create') {
    // A username (preferred) or a real email address.
    const username =
      typeof body.username === 'string'
        ? body.username.trim().toLowerCase().replace(/\s+/g, '')
        : ''
    if (username && !USERNAME.test(username)) {
      return fail(
        400,
        'Usernames are 2 to 30 characters: lowercase letters, digits, dot, dash or underscore.',
      )
    }
    const email = username
      ? `${username}@${MEMBER_LOGIN_DOMAIN}`
      : typeof body.email === 'string'
        ? body.email.trim().toLowerCase()
        : ''
    const name = typeof body.display_name === 'string' ? body.display_name.trim() : ''
    const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null
    if (!EMAIL.test(email) || email.length > 254) return fail(400, 'Enter a username.')
    if (name.length < 1 || name.length > 60) return fail(400, 'Enter a name of 1 to 60 characters.')
    if (phone && !PHONE.test(phone)) return fail(400, 'Enter a phone number of 7 to 20 digits.')
    const passwordProblem = checkPassword(body.password)
    if (passwordProblem) return fail(400, passwordProblem)

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: body.password as string,
      email_confirm: true, // no email is sent; the admin shares the login in person
      user_metadata: { display_name: name },
    })
    if (error || !created.user) {
      const exists = error?.code === 'email_exists' || /already/i.test(error?.message ?? '')
      if (exists) return fail(409, 'That username is already taken.')
      if (error?.code === 'weak_password')
        return fail(400, 'That password is too weak. Try a longer one.')
      return fail(500, 'The account could not be created. Try again.')
    }

    const memberId = created.user.id
    // The database trigger created the profile and private row; finish them.
    const { error: privateError } = await admin
      .from('member_private')
      .update({ phone, must_change_password: true })
      .eq('member_id', memberId)
    if (privateError) {
      await admin.auth.admin.deleteUser(memberId)
      return fail(500, 'The account could not be created. Nothing was saved; try again.')
    }

    await audit('member.created', memberId, { email, display_name: name })
    return reply(200, { member_id: memberId, email })
  }

  // 3. Admin-assisted password reset (no email needed).
  if (body.action === 'reset_password') {
    const memberId = typeof body.member_id === 'string' ? body.member_id : ''
    if (!UUID.test(memberId)) return fail(400, 'Choose a member.')
    if (memberId === caller.user.id) {
      return fail(400, 'Change your own password in Settings → Security.')
    }
    // Two admins (2026-11-24): one admin must not be able to take over the other's account.
    const { data: target } = await admin
      .from('profiles')
      .select('role')
      .eq('id', memberId)
      .maybeSingle()
    if (target?.role === 'admin') {
      return fail(403, 'An admin changes their own password in Settings → Security.')
    }
    const passwordProblem = checkPassword(body.password)
    if (passwordProblem) return fail(400, passwordProblem)

    const { error } = await admin.auth.admin.updateUserById(memberId, {
      password: body.password as string,
    })
    if (error) {
      if (error.code === 'user_not_found') return fail(404, 'Member not found.')
      if (error.code === 'weak_password')
        return fail(400, 'That password is too weak. Try a longer one.')
      return fail(500, 'The password could not be reset. Try again.')
    }
    await admin
      .from('member_private')
      .update({ must_change_password: true })
      .eq('member_id', memberId)
    await audit('member.password_reset', memberId, {})
    return reply(200, { member_id: memberId })
  }

  // 4. Delete a member account, keeping all history (2026-11-24).
  if (body.action === 'delete') {
    const memberId = typeof body.member_id === 'string' ? body.member_id : ''
    if (!UUID.test(memberId)) return fail(400, 'Choose a member.')
    if (memberId === caller.user.id) return fail(400, 'You cannot delete your own account.')
    const reason = typeof body.reason === 'string' ? body.reason : ''

    // The database step runs as the calling admin, so the admin check, the rules and the
    // audit log (who, when, why) are the same as for every other admin action.
    const asCaller = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      },
    )
    const { error: deleteError } = await asCaller.rpc('admin_delete_member', {
      p_member_id: memberId,
      p_reason: reason,
    })
    // Already deleted: a retry after a failed login lock; just lock it again.
    if (deleteError && deleteError.message !== 'This member is already deleted.')
      return fail(400, deleteError.message)

    // Lock the login for good and free the username for a new member. The profile and all
    // history stay (the auth user is not removed, so nothing that refers to it breaks).
    const { error: lockError } = await admin.auth.admin.updateUserById(memberId, {
      email: `deleted-${memberId}@${MEMBER_LOGIN_DOMAIN}`,
      email_confirm: true,
      ban_duration: '876000h',
    })
    if (lockError) {
      // The member is already inactive (cannot use the app); report so the admin can retry.
      return fail(
        500,
        'The member was removed from the team, but the login could not be locked. Try again.',
      )
    }
    return reply(200, { member_id: memberId })
  }

  return fail(400, 'Unknown action.')
})
