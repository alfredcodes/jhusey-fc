# Local Development and Account Setup

## First-time setup
1. Start Docker Desktop.
2. `npm install`
3. `npm run db:start`. The first run downloads images, which takes several minutes.
4. Copy `.env.example` to `.env.local` and fill in:
   - `VITE_SUPABASE_URL=http://127.0.0.1:54321`
   - `VITE_SUPABASE_PUBLISHABLE_KEY=` the `PUBLISHABLE_KEY` value from `npm run db:status`
5. `npm run dev` and open http://localhost:5173

Never put `SECRET_KEY` or `SERVICE_ROLE_KEY` in `.env.local` or any `VITE_` variable.

## Local URLs
| Service | URL |
|---|---|
| App (Vite) | http://localhost:5173 |
| Supabase Studio (local dashboard) | http://127.0.0.1:54323 |
| Mailpit (catches every local email) | http://127.0.0.1:54324 |

## Testing the installable app (PWA) locally
The service worker exists only in production builds: `npm run build` then `npx vite preview`
(http://localhost:4173). `npm run dev` never registers it. To start clean in Chrome: DevTools →
Application → Storage → Clear site data.

## Adding a member (local)
The admin opens **Members → Add member**, enters name, email, optional phone and an initial password
(or **Generate**), and shares the login shown once. The member must choose a new password at first
sign-in. Forgotten password: **Members → Reset password** sets a temporary one. No email is sent.

This uses the Edge Function `supabase/functions/admin-users`. `npm run db:start` starts it (edge
runtime enabled in `config.toml`); if it is not running, use `npx supabase functions serve`.

Public sign-up is disabled (`enable_signup = false`).

## Bootstrapping the admins (up to two)
Create the first user in Studio → Authentication → Users → Add user (email + password, auto-confirm),
then run once in Studio → SQL Editor:
```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'ADMIN_EMAIL_HERE');
```
Run it again with the second admin's email for a co-admin. The database refuses a third admin
(trigger `profiles_admin_limit`). To remove an admin: `update public.profiles set role = 'member' where id = (select id from auth.users where email = '...');`

## Database workflow
| Command | What it does |
|---|---|
| `npm run db:reset` | Rebuild the local DB from `supabase/migrations` (deletes local data) |
| `npm run db:test` | Run the pgTAP tests in `supabase/tests` |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` after a schema change |
| `npm run db:stop` | Stop the containers (data is kept) |

New migration: `npx supabase migration new <name>`. Never edit a migration that has already been applied to a hosted project.

## Hosted project checklist (Phase 7, after approval)
- Authentication → Sign In / Providers: disable "Allow new users to sign up".
- Authentication → URL Configuration: Site URL = the Pages URL.
- No email/SMTP setup: the app sends no email (zero-cost decision, 2026-11-22).
- Deploy the Edge Function: `npx supabase functions deploy admin-users --no-verify-jwt` (it checks the admin itself). The service-role key is provided by Supabase automatically; never put it in Pages variables.
- Storage: the `payment-proofs` bucket and its policies are created by migration `20261123120000_fee_submissions.sql` (free tier: 1 GB). Locally, `[storage] enabled = true` in `config.toml`.
- pg_cron is enabled by the migration (absence fines every 15 minutes); check Integrations → Cron after `db push`.
- Minimum password length 8. Enable TOTP MFA for the admin.
- Apply migrations with `supabase db push` only after explicit approval. It is denied in `.claude/settings.json` until then.
