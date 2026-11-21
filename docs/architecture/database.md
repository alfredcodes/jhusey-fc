# Database Architecture

Use PostgreSQL because the data is relational and needs transactions, constraints, reporting and row-level security.

## Proposed core tables
| Table | Purpose |
|---|---|
| `profiles` | Auth-linked member profile and role (`admin` or `member`) |
| `venues` | Futsal venue name, coordinates and configurable geofence radius |
| `sessions` | Scheduled session date/time, venue reference and status |
| `attendance` | One punch-in per member/session with server timestamp and GPS evidence |
| `attendance_corrections` | Append-only correction history; preserve original attendance |
| `fine_rules` | Configurable rule metadata; confirmed late rule defaults to NPR 50 |
| `fines` | Fine incident, member, amount snapshot, source and status |
| `payments` | Manually recorded payment and admin confirmation |
| `absence_notifications` | Member's absence communication record, if that workflow is retained |
| `announcements` | Admin announcements |
| `notifications` | In-app notifications only if needed by the first release |
| `audit_logs` | Sensitive admin actions and corrections |

Do not create `session_pins` or `pin_attempts`. Session PIN verification was explicitly removed.

## Key constraints
- `attendance`: unique `(member_id, session_id)` to prevent duplicate punch-in.
- Foreign keys for member/session/venue/fine/payment relationships.
- Use `timestamptz` for actual event timestamps; store UTC instants and display in `Asia/Kathmandu`.
- Store `latitude`, `longitude`, `accuracy_m`, `distance_m`, venue reference/snapshot and `location_verified`.
- Keep the original attendance row immutable to members. Corrections are separate rows with actor, reason, timestamp and old/new values.
- Fine amount is snapshotted on creation so later rule edits do not rewrite historical liabilities.
- Payment status changes must be auditable.

## Attendance fields (suggested)
`id`, `member_id`, `session_id`, `venue_id`, `punched_in_at`, `latitude`, `longitude`, `accuracy_m`, `distance_m`, `attendance_status`, `location_verified`, `created_at`.

Use `punched_in_at` as a server-generated `timestamptz`. Do not accept client-supplied timestamp or status.

## Financial model
Keep fine and payment records separate. A fine can be pending, paid or waived. Payments are entered and confirmed by admin; do not auto-mark paid from a member's claim. Decide whether partial payments are allowed before implementing them; simplest first release can record one or more confirmed payment transactions against a fine only if the business process requires it.

## Privacy
Members can read their own precise GPS records. Team attendance view should expose only status/attendance indicators, not precise coordinates or location history of other members. Admin can access all records.
