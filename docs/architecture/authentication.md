# Authentication and Authorization

## Accounts
- Every team member has an individual authenticated account.
- Roles: `member` and `admin`.
- One admin account initially.
- No public registration as admin. Admin creation/role assignment is a controlled bootstrap operation.
- No shared member login.
- Onboarding (confirmed 2026-11-21): the admin invites each member from the Supabase Dashboard; public sign-ups are disabled. A trigger on `auth.users` creates the `profiles` row with role `member`. Invite and password-reset emails go through custom SMTP (Resend).
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
