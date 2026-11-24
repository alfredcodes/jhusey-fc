# Launch Checklist (Phase 7B) and Full Test Checklist

Nothing in this file has been done yet. Each step that creates an account, costs money,
touches production or goes public needs the owner's explicit go-ahead.

## A. Full local test pass (before launch)
Start Docker Desktop, then `npm run db:start` and `npm run dev`. Add test members as the admin from
**Members → Add member** (no email is sent).
To fake a phone location on a laptop: Chrome DevTools (F12) → ⋮ → More tools → Sensors →
Location, e.g. `27.7202, 85.3408` (about 40 m from the venue).

### Accounts
- [ ] Admin adds a member → login shown once → member signs in → must choose a new password → dashboard.
- [ ] Member signs in with their username (not an email). The same username a second time is refused. Members → Reset password → temporary password works once, then must change.
- [ ] Settings → Security: change password (wrong current password refused).
- [ ] Wrong password shows one generic message.
- [ ] Forgot password page says to ask the admin.
- [ ] Member sees the same screens read-only: no Add/Edit/Override/Waive/Mark paid/Void buttons, no Audit Log, Settings shows only Profile and Security (also with `?tab=rules`).
- [ ] Deactivated member sees "Account deactivated".

### Venue and sessions (admin)
- [ ] Venue shows radius 100 m, GPS accuracy ±50 m, "Check on map" opens the right place.
- [ ] Create sessions for chosen weekdays; running again creates none.
- [ ] Cancel and restore a session; member sees "Cancelled".

### Punch-in (needs a session today; test between 6:30 and 9:00 PM)
- [ ] Before 6:30 PM: "Punch-in opens at 6:30 PM."
- [ ] Location far away: "You are … m from Dhanyentari Futsal."
- [ ] Sensors location near the venue, before 7:15:00 PM: On time, no fine.
- [ ] Another member after 7:15:01 PM: Late, Rs. 50 fine shown.
- [ ] Sessions → Can't come for tomorrow; withdraw; send again. Same-day notice is refused.
- [ ] After 9:00 PM (+ up to 15 min): absentees without notice get Rs. 100; excused members do not.
- [ ] Settings → Rules: change the late fine; the next late punch-in uses it, older fines keep theirs.
- [ ] Second tap: "You have already punched in".
- [ ] Block location permission: clear explanation, nothing recorded.

### Member pages
- [ ] Home stats and My attendance match what happened; map link opens.
- [ ] Team shows names + On time/Late only.
- [ ] After 9:00 PM, members who did not punch in show as Absent (no fine).

### Admin operations
- [ ] Attendance: change Late → On time with a reason; fine becomes waived; member sees "Corrected".
- [ ] Record attendance for a member without GPS at 7:20 → Late + fine, marked "Recorded by the admin".
- [ ] Fines: pay two fines in one payment; member sees them paid.
- [ ] Void that payment with a reason; fines are unpaid again.
- [ ] Waive a fine with a reason.
- [ ] Members: rename and deactivate/reactivate a member.
- [ ] Audit shows every action above with who, when and why.
- [ ] Reports: numbers match; all four CSV downloads open in Excel/Sheets.

## B. Going live (each step needs approval)
1. **Hosted Supabase project** (free tier): the owner creates the account and project
   (region close to Nepal, e.g. Mumbai `ap-south-1`).
2. **Configure Auth** in the hosted dashboard (see `local-development.md` → hosted checklist):
   disable sign-ups, Site URL, redirect `<site>/set-password`, email templates, min password 8,
   admin MFA.
3. **Email:** none. The app sends no email (zero-cost decision, 2026-11-22).
4. **Apply the database:** `npx supabase link` and `npx supabase db push` (both blocked in
   `.claude/settings.json` until approved). Then run the pgTAP suite against a non-production
   copy only, never production data.
5. **Bootstrap the admin:** add the user in the dashboard (auto-confirm), then the one-line SQL update. Deploy the `admin-users` function (see local-development.md).
6. **Cloudflare Pages:** connect the GitHub repo; build command `npm run build`, output `dist`;
   environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (publishable
   only). Single-page routing works by default (no `404.html`). `public/_headers` adds security
   headers.
7. **Venue test:** at the court, several members on different phones punch in from the court
   and the car park. Read distance and accuracy in the admin Attendance page, then set the
   radius and accuracy limit from real numbers.
8. **Backups:** download the four CSVs from Reports at least monthly, and keep the project
   active (free projects pause after 7 days without activity, e.g. in an off-season).
