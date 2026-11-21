# Payments

## Initial approach
- No payment gateway in the first release.
- Members can see their own fines and payment status.
- Admin manually records and confirms payments.
- A member-submitted reference or evidence is not proof of payment and must not automatically mark a fine paid.
- Record who confirmed a payment and when.
- Keep financial history auditable; distinguish assigned, collected, outstanding and waived amounts.
- Never overwrite/delete historical payment events to correct a mistake; use a compensating or correction record.

## Decisions still needed
- Are partial payments allowed?
- Which payment methods are accepted (cash, bank transfer, wallet)?
- Is evidence upload needed at launch?
- Can one payment cover multiple fines?
Keep the first version simple and implement only the agreed payment workflow.
