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

## Inviting a member (local)
1. Studio → Authentication → Users → Add user → Send invitation.
2. Open Mailpit and click the invite link. It opens `/set-password?token_hash=…&type=invite`.
3. Choose a password. The member is signed in and lands on the dashboard.

Public sign-up is disabled (`enable_signup = false`), so invitation is the only way in.

## Bootstrapping the single admin
Invite the admin like any member, then run once in Studio → SQL Editor:
```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'ADMIN_EMAIL_HERE');
```
The database refuses a second admin (`profiles_single_admin` unique index).

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
- Authentication → URL Configuration: Site URL = the Pages URL; add `<site>/set-password` to the redirect URLs.
- Authentication → Emails: paste `supabase/templates/invite.html` and `recovery.html` with the same subjects as `config.toml`.
- Authentication → Emails → SMTP: Resend (`smtp.resend.com`, port 465, user `resend`, password = Resend API key).
  **Resend needs a verified domain you own to email anyone other than your own Resend account address.** See open question 19.
- Minimum password length 8. Enable TOTP MFA for the admin.
- Apply migrations with `supabase db push` only after explicit approval. It is denied in `.claude/settings.json` until then.
