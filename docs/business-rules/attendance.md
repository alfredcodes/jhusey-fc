# Attendance Business Rules

## Confirmed
- Timezone: `Asia/Kathmandu`.
- Fixed daily attendance cutoff: 19:15:00 (7:15 PM) local Nepal time.
- At or before 19:15:00: On Time.
- From 19:15:01 onward: Late.
- Late fine: NPR 50.
- Punch-in requires GPS only. No Session PIN or second code-based verification.
- The server/database generates the official timestamp.
- One attendance record per member per session.
- Member can view their own history and punch-in details.
- Members cannot edit attendance evidence.
- Admin corrections preserve original values and record actor, time and reason.

## Classification
For the session's local date, construct the cutoff at 19:15:00 in `Asia/Kathmandu`. Compare the trusted server timestamp converted to that timezone against that cutoff. Use a timezone-aware implementation; do not compare locale-formatted strings or browser clock values.

Test boundaries:
- 19:14:59 -> On Time
- 19:15:00 -> On Time
- 19:15:01 -> Late + NPR 50

## Who counts for a game (2026-11-24)
A member counts for a game (absence, absence fine, reports, roster, My Record) from their join date,
except on days inside an inactive period: deactivating opens one from that day, reactivating closes it
on the day before. Games while inactive are never absences and never fined, also after reactivation.
Stored in `member_inactive_periods`; decided by `member_counted_on()`.

## Partial-plan players (2026-11-24)
- Monthly fee as before (partial plan amount), however many games they play.
- They tap "I'm coming" for each game they plan to play, and may withdraw until 9 PM the day before;
  after that the choice is locked (the admin can still excuse with a reason).
- Expected only at confirmed games: a confirmed game without punch-in is an absence with the normal
  absence fine. Unconfirmed games are not counted at all. Coming anyway and punching in counts.
- Punch-in, GPS check, On time / Late and the late fine are exactly as for regular players.
- Stored in `game_commitments`; decided by `member_expected()` (current plan of the member).

## Sessions
Sessions are recurring, but each attendance record must reference a concrete session/date. A member cannot punch in twice for the same session. Absence status should be derived only after the relevant session's attendance window is closed and must not automatically create a fine unless an approved rule says so.

## Dashboard data
Member dashboard must query real records: scheduled, attended, on-time, late, absent, attendance percentage, fines assigned/paid/outstanding, latest punch-in and recent history. Do not hardcode values.
