# Open Questions - Do Not Guess

1. **NPR 200 communication penalty:** exact trigger, deadline, evidence, grace period, waiver and appeal rules.
2. **GPS accuracy threshold:** starts at 50 m (2026-11-22), admin-editable per venue; confirm after testing phones at the venue.
3. **Geofence radius:** 100m is provisional. Confirm actual venue coordinates and acceptable radius.
4. **Absence rules:** when is someone considered absent, and does absence ever create a fine? Do not assume.
5. **Absence notification:** what must a member submit, and by what time?
6. **Admin recovery:** who can recover the one admin account if the admin loses access?
7. ~~Member onboarding~~ **Resolved 2026-11-21:** admin invites from Supabase Dashboard; sign-ups disabled; Resend SMTP.
8. **Payment workflow:** accepted methods, evidence, partial payments and whether one payment can cover multiple fines.
9. **Session schedule:** exact four weekly days and whether all sessions always share the same 7:15 PM deadline.
10. **Location privacy:** default since 2026-11-22: team view lists only members who punched in (name + On Time/Late); the admin dashboard also lists who has not. Change on request.
    Original question: whether team-wide attendance view should show only On Time/Late/Absent or also who has not punched in yet.
11. **Retention:** how long should precise GPS coordinates and payment evidence be retained?
12. **Notifications:** are in-app notices sufficient, or are email/push/WhatsApp messages required? External messaging may add cost.
13. ~~Sub-second boundary~~ **Resolved 2026-11-22:** whole seconds; up to 19:15:00.999 is On Time.
    Was: is 19:15:00.999 On Time? Proposal: truncate server time to whole seconds (yes, On Time).
14. ~~Punch-in window~~ **Resolved 2026-11-22:** 18:30:00-21:00:00 Nepal time on the session date.
    Was: when does punch-in open and close? Proposal: same Nepal calendar date as the session, between an agreed open and close time.
15. ~~Manual attendance~~ **Resolved 2026-11-22:** yes; admin records arrival time + reason, source = admin, no GPS, same 19:15 rule and fine.
    Was: can the admin record attendance (without GPS) for a member whose phone failed at the venue? Affects nullable GPS columns.
16. **Absence vs late:** a late member who does not punch in is Absent with no fine, which is cheaper than Late (NPR 50). Acknowledge, or define an absence rule?
17. ~~Payment model~~ **Resolved 2026-11-22:** one payment covers one or more whole pending fines of one member; no partial payments; mistakes are voided with a reason.
    Was: proposal for v1: one confirmed payment covers one or more whole fines; no partial payments.
18. **Phone numbers:** drop from v1, or store in a separate admin-only table? (Phase 2 created no phone column.)
19. **Email sending domain:** Resend only delivers to arbitrary recipients from a verified domain. `jhusey-fc.com` is not purchased. Before inviting real members, either buy the domain (or use another domain you own) and verify it in Resend, or choose another approach.
