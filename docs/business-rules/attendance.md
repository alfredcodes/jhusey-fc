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

## Sessions
Sessions are recurring, but each attendance record must reference a concrete session/date. A member cannot punch in twice for the same session. Absence status should be derived only after the relevant session's attendance window is closed and must not automatically create a fine unless an approved rule says so.

## Dashboard data
Member dashboard must query real records: scheduled, attended, on-time, late, absent, attendance percentage, fines assigned/paid/outstanding, latest punch-in and recent history. Do not hardcode values.
