# Security Checklist

## Before implementation
- [ ] Confirm who owns and recovers the single admin account.
- [ ] Decide member invitation/account creation flow.
- [ ] Confirm GPS accuracy threshold and geofence radius at the actual venue.
- [ ] Clarify NPR 200 communication penalty or explicitly defer it.
- [ ] Define who can see team attendance summaries.

## During implementation
- [ ] Supabase secret/service-role key never reaches browser or Git.
- [ ] RLS enabled on all exposed tables.
- [ ] Grants and policies reviewed together.
- [ ] Admin role cannot be self-assigned or edited by members.
- [ ] Punch-in timestamp generated server-side.
- [ ] GPS coordinates validated and distance computed server-side.
- [ ] Unique attendance constraint enforced in database.
- [ ] Attendance and late fine committed atomically.
- [ ] Member A cannot read Member B's precise GPS.
- [ ] Members cannot update attendance, fines or payment confirmations.
- [ ] Admin corrections and payment/fine actions are audited.
- [ ] Inputs validated; errors do not leak secrets or internal details.
- [ ] Rate limits and abuse controls considered for auth and punch-in endpoint.
- [ ] Backups/export process documented and tested.

## Before launch
- [ ] Test on actual Android/iOS browsers at the futsal venue.
- [ ] Test denied GPS permission, low accuracy, spoofed/mock location limitations and outside-radius cases.
- [ ] Test 19:14:59, 19:15:00 and 19:15:01.
- [ ] Test duplicate punch-in and concurrent requests.
- [ ] Test member/member/admin/anonymous RLS matrix.
- [ ] Verify HTTPS and browser geolocation permission behavior.
- [ ] Verify recovery, backup and restore procedure.
- [ ] Review current free-tier limits and acceptable downtime.
