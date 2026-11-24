# Payments

## Initial approach
- No payment gateway in the first release.
- Members can see their own fines and payment status.
- Admin manually records and confirms payments.
- A member-submitted reference or evidence is not proof of payment and must not automatically mark a fine paid.
- Record who confirmed a payment and when.
- Keep financial history auditable; distinguish assigned, collected, outstanding and waived amounts.
- Never overwrite/delete historical payment events to correct a mistake; use a compensating or correction record.

## Fine payments (decided 2026-11-22)
- One payment covers one or more whole pending fines of one member; no partial payments.
- Methods: cash, bank transfer, wallet, other. Shown under Fines → Fine payments.

## Monthly membership fees (decided 2026-11-22)
- Separate from fines, on the Monthly Fees page.
- Two plans, Regular and Partial. The admin sets both amounts (defaults NPR 800 / 400) and each member's plan.
- The admin opens each month by choosing its open date. Every active member then gets a fee at their plan's current amount. Opening again only adds active members who have no fee yet.
- Changing plan amounts or a member's plan never changes existing fees. The admin can adjust one member's fee for one month, with a reason, never below what is already paid.
- Due within N days of the open date; N is set in Settings → Rules (default 16) and each month keeps the N it was opened with. Unpaid after that shows as Overdue. No late penalty.

- Members may pay in instalments; a payment never exceeds the remaining balance and its date cannot be in the future.
- The admin can exempt a member for a month with a reason the whole team can read. Payments on that fee must be voided first.
- Mistaken payments are voided with a reason, never deleted.
- The whole team reads every fee, its status and payments (amount, date, method). Payment notes and void reasons stay with the admin.

## Fine deadline (decided 2026-11-23)
- Optional: Settings → Rules → "Pay fines within (days)". Empty means no deadline (the default).
- Each fine gets its due date when it is given (Nepal date + N days); changing N later never moves existing due dates.
- An unpaid fine past its due date shows as Overdue. No extra penalty.

## Decisions still needed
- Retention: how long to keep payment receipts (see open questions).

## Member payment submissions (decided 2026-11-23)
- On Monthly Fees, a member submits a payment for one of their own fees: cash, or bank transfer / wallet with a screenshot or receipt (JPG, PNG, WebP or PDF, max 2 MB, private bucket `payment-proofs`, own folder only).
- Nothing counts as paid until the admin approves. Approval records an ordinary fee payment (same balance rules, audit log); rejection needs a reason the member sees.
- One submission waiting for approval per member per month; none for a paid or exempt month; the amount may be an instalment but never more than the balance.
- Receipts and submissions are visible to the member and the admin only. The admin is notified in the app (bell); the member sees Pending approval / Approved / Rejected.
Keep the first version simple and implement only the agreed payment workflow.
