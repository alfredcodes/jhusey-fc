# Authentication and Authorization

## Accounts
- Every team member has an individual authenticated account.
- Roles: `member` and `admin`.
- One admin account initially.
- No public registration as admin. Admin creation/role assignment is a controlled bootstrap operation.
- No shared member login.
- Onboarding (2026-11-22, replaces the 2026-11-21 email invites): the admin creates each account in the app (Members → Add member, Edge Function `admin-users`) with an initial password; public sign-ups are disabled; no email is sent. A trigger on `auth.users` creates the `profiles` row with role `member`. The member must choose a new password at first sign-in.
- Sign-in by username (2026-11-23): members sign in with a username (it may be their phone number) and a password. Supabase Auth needs an email, so the username is stored as `<username>@members.jhusey-fc.invalid` (`.invalid` is reserved and undeliverable); `src/lib/login-name.ts` converts both ways and the sign-in box also accepts a real email (the admin's). Usernames: 2–30 of `a-z 0-9 . _ -`.
- Initial passwords may be the same for a batch of new members (owner request 2026-11-23). Risk: until a member changes it, a teammate who knows the shared password could sign in as them. The forced change at first sign-in limits this; ask everyone to sign in and change it promptly.
- Admin bootstrap: invite the admin like any member, then set `role = 'admin'` once with SQL in the dashboard. This is not done in a migration, because user IDs differ per environment.

## Authorization layers
1. React route protection for navigation and user experience.
2. Supabase Auth identity for authenticated requests.
3. PostgreSQL grants and RLS for every exposed table.
4. Trusted server functions for operations requiring privileged validation.

The frontend role value is not authoritative. Members must not be able to update their own role or another user's profile role.

## Admin protection
- Strong unique password and MFA if available.
- Verified email recovery.
- No admin signup route.
- Restrict role assignment to trusted admin/bootstrap operations.
- Keep audit history for attendance corrections, fine waivers and payment confirmations.
- Document account recovery because one admin is a single point of failure.

## RLS design principles
- Members may read/update only explicitly permitted profile fields for themselves.
- Members may read their own attendance, fines and payment summaries.
- Members cannot insert/update/delete attendance evidence, fines or payment confirmations directly.
- Team attendance uses a safe view/RPC that omits precise GPS and private data; verify view security semantics (e.g. `security_invoker`) and test access.
- Admin policies grant only required operations.
- Test both allowed and denied operations for member/admin/anonymous roles.

Never rely on a hidden button or route guard as authorization.
