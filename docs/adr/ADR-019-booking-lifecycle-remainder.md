# ADR-019: Booking lifecycle remainder — expiry, refunds, edit-lock

- **Status:** Accepted
- **Level:** Software (C4 Level 3 · Component)
- **Date:** 2026-10-10

**Context.** FR-007's first increment (booking eligibility) and FR-009 (settlement) are implemented. The remainder — auto-expiring unpaid holds, refunding Learners when a class or booking is cancelled, marking Teacher no-shows, and locking class edits after the first confirmed booking — is not. OQ-003 (cancellation/refund/no-show policy) and OQ-007 (capacity/hold semantics) are already resolved in the SRS (AC-022–AC-030); the income-release half of OQ-006 is resolved by ADR-018. What remains is to fix the concrete constants and the cross-module mechanism.

Constraints: integer credits; refunds are internal wallet credits, never real money; refunds and settlement cross the `live-class` → `wallet-ledger` boundary, which ADR-018 already routes through the transactional outbox (ADR-013); no cross-schema FKs; injectable clock; no external scheduler is provisioned.

**Decision.**

1. **Hold TTL.** A `pending` booking releases its seat and becomes `cancelled` after **15 minutes** (`DEFAULT_HOLD_TTL_MS`). This is enforced by a periodic sweep that cancels `pending` bookings whose `expires_at <= now` (atomic `WHERE state = 'pending'`, idempotent under concurrency). AC-026 / OQ-007.
2. **Refunds are event-driven and only for settled bookings.** A booking that is cancelled for any reason emits a `booking.cancelled` event (outbox, same transaction as the state change). The `wallet-ledger` consumer refunds **only if the booking was settled** (a `learner_debit` exists); a booking that was still `pending` had nothing charged, so the consumer is a no-op. The Learner's full `price_credits` is returned to their available balance, the Teacher's `pending_credits` is reduced by the teacher share, and the platform fee is reversed in the ledger — all atomic and idempotent under a per-booking refund key. AC-022, AC-027.
3. **Teacher no-show.** A confirmed booking whose class has started and whose Teacher has not joined within the first **15 minutes** (`TEACHER_NO_SHOW_WINDOW_MS`) is cancelled with reason `teacher_no_show` and refunded; no penalty is applied in the MVP (AC-024). Detecting the join depends on FR-011 room access, so the *operation* lives here and its trigger is wired by FR-011.
4. **Edit-lock.** Once a class has at least one `confirmed` booking, its teacher/content/skills/schedule/duration/price/capacity become immutable (`ClassLockedError`); only cancellation remains. AC-017.
5. **No Learner self-cancellation.** The MVP offers no Learner-initiated booking cancellation (AC-023); the only `pending` release is the expiry sweep, and the only `confirmed` releases are class-cancellation and no-show.

**Rationale.** A short, sweeping TTL is the simplest way to release seats without a per-booking timer, and an atomic conditional UPDATE makes it safe when several sweeps or a confirm race. Routing refunds through the same outbox as settlement (ADR-018) keeps the two modules independent and makes the wallet the single place that owns money math, so `live-class` only knows the reason, not the split. Charging nothing for `pending` bookings means the refund path is naturally a no-op for expired holds, which keeps expiry cheap.

**Consequences.**

- (+) AC-017, AC-022, AC-024, AC-026, AC-027 become implementable and testable.
- (+) Refunds are eventually consistent and idempotent; over-refunding is prevented by a per-booking unique key.
- (−) The expiry sweep adds a background interval to the API process; it is guarded against overlap and unref'd so it never keeps the process alive.
- (−) A Teacher-pending reduction uses `GREATEST(0, …)` to avoid a negative pending, which is acceptable because completed (released) classes are not a cancellation path in the MVP.
- (−) No-show detection is inert until FR-011 supplies attendance.

**Verification.**
- Unit: `isPendingExpired` boundary (exactly TTL), cancel transitions and terminal no-ops, edit-lock raises `ClassLockedError` after a confirmed booking.
- Use case: sweep cancels exactly the expired pending set and is idempotent; class cancellation cancels active bookings and emits one `booking.cancelled` each; no-show inside the window does not cancel, outside it does.
- Wallet: refund credits the Learner, reduces Teacher pending, is a no-op for an unsettled booking and on replay.
- Architecture tests stay green.
