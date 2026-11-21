# Fine Rules

## Confirmed rule
- Late arrival fine: NPR 50.
- A punch-in at 19:15:00 Asia/Kathmandu is On Time and has no late fine.
- A punch-in at 19:15:01 or later is Late and creates NPR 50 fine.
- Fine generation must happen in the same database transaction as attendance insertion.
- Prevent duplicate fines for the same attendance incident.
- Store amount/rule snapshot so future rule edits do not rewrite historical fines.
- Fine statuses: Pending, Paid, Waived.
- Only admin can waive or mark a fine paid through a confirmed payment record; members cannot edit fine status.

## Unresolved
The NPR 200 communication-related penalty has no confirmed trigger or workflow. Do not implement until the team decides:
- What exact behaviour triggers it?
- What is the deadline and timezone?
- What evidence is accepted?
- Is there a grace period?
- Who can waive it?
- Can it be appealed?

Do not infer that it is automatically charged for absence or late notice.
