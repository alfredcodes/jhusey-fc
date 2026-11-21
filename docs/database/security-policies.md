# Database Security and RLS Policies

## Required baseline
- Enable RLS on every table exposed through the Supabase Data API.
- Review table grants as well as policies. RLS policies do not automatically remove broad grants.
- Write explicit `SELECT`, `INSERT`, `UPDATE` and `DELETE` policies for the roles that need them.
- Use `to authenticated` / `to anon` deliberately; default to no anonymous access.
- Never put the Supabase secret/service-role key in frontend code.
- Treat views as security-sensitive: PostgreSQL views can bypass underlying RLS by default unless configured appropriately (for example `security_invoker = true` on supported versions) or access is otherwise restricted.
- Use a trusted function with carefully scoped privileges for punch-in and admin-only operations.

## Access matrix (conceptual)
| Resource | Member | Admin |
|---|---|---|
| Own profile | Read; limited editable fields | Read/manage |
| Other profiles | Limited team directory fields only | Read/manage |
| Own attendance | Read | Read/manage through audited correction |
| Other attendance | Status-only team summary | Read |
| Precise GPS | Own records only | All |
| Fines | Own read-only | Manage/waive |
| Payments | Own summary/read-only | Record/confirm |
| Sessions | Read | Manage |
| Announcements | Read | Manage |
| Audit logs | No | Read |

## Punch-in security
- Authenticate user; derive member ID from auth context.
- Do not accept a user-supplied member ID, timestamp, fine amount, status or distance as authoritative.
- Validate coordinates are finite and within legal ranges.
- Validate reported accuracy and apply an explicitly agreed threshold.
- Calculate distance server-side from venue coordinates.
- Enforce radius and unique `(member_id, session_id)`.
- Use server time.
- Create attendance and late fine atomically.
- Return only fields needed by the signed-in member.

## Tests
For every table, test allowed and denied reads/writes as anonymous, member A, member B and admin. Verify member A cannot read member B's precise GPS, change role, alter timestamp, insert a fine, confirm a payment or bypass a unique attendance constraint.

Use Supabase's database test tooling/pgTAP where practical. Test RLS in a local or dedicated non-production project before any production migration.
