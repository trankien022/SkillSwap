# ADR-018: Booking settlement — floor fee, pending income, event-driven confirmation

- **Status:** Accepted
- **Level:** Software (C4 Level 3 · Component)
- **Date:** 2026-10-09

**Context.** FR-009 requires that confirming a booking atomically debits the Learner, allocates 90% to the Teacher, and records the 10% platform fee. The pieces are half-built: `wallet-ledger` has a `RecordBookingConfirmedUseCase` and a `booking.confirmed` consumer, but no producer emits the event, and there is no Learner debit path or Teacher pending-income bucket. Three decisions were open: OQ-012 (commission rounding), the income-release half of OQ-006, and how the module boundary should be crossed (event vs synchronous call).

Constraints: money is integer credits (1 credit = 1,000 VND), platform fee 1000 bps, no floats; only TypeORM behind outbound ports (ADR-014); cross-module coordination uses the transactional outbox plus idempotent consumers (ADR-013); no cross-schema FKs.

**Decision.**

1. **OQ-012 — rounding.** `fee = floor(price * feeBps / 10000)`, `teacher = price - fee`. This is the existing `applyPlatformFee` behaviour; the invariant `teacher + fee == price` holds exactly. The remainder of an indivisible split goes to the Teacher.
2. **OQ-006 — release timing.** A confirmed booking credits the Teacher's **`pending_credits`**, not `available_credits`. Pending income is released to available when the class reaches **Completed** (FR-020). Cancellation and no-show follow OQ-003 refunds (FR-007 remainder). Release is idempotent under a release key so a retry cannot double-release (AC-015).
3. **Trigger — event-driven.** Confirming a booking is done by `live-class`, which writes the booking state **and** an outbox `booking.confirmed` row in the same transaction (ADR-013). The `wallet-ledger` consumer settles asynchronously and idempotently. The booking is therefore the source of truth for the transition; settlement is a downstream effect.

**Rationale.** Flooring the fee and giving the remainder to the Teacher is the least surprising integer rule and already matches the code, so no migration of behaviour is needed. Holding Teacher income in `pending` until completion is the conservative default that makes the cancellation/no-show refunds of OQ-003 possible without clawing back already-available income. Choosing the outbox event (over a synchronous port) keeps `live-class` and `wallet-ledger` independent — the consumer already existed — at the cost of eventual consistency, which the booking state machine already tolerates because a booking is `pending` until the wallet confirms.

**Consequences.**

- (+) FR-009 becomes implementable and testable; AC-004, AC-005 and AC-015 are directly covered.
- (+) No change to the fee rule already in use; the invariant is explicit and tested.
- (+) The module boundary stays an event, so neither module imports the other.
- (−) Confirmation is eventually consistent: a booking is not `confirmed` until the consumer settles it. A failed settle must leave no partial wallet state and must be retryable.
- (−) The Learner debit and the Teacher pending credit must be one transaction, or AC-005 can be violated.

**Verification.**
- Unit: `splitSettlement(100)= {fee 10, teacher 90}`, `(101)= {10, 91}`, `(1)= {0, 1}`; invariant holds; no float.
- Use case: sufficient balance debits exactly once; insufficient balance leaves no booking/balance change; a second `booking.confirmed` for the same booking is a no-op; release with a different key does not double-release (AC-015).
- Integration: settlement failure rolls back the whole transaction (AC-005).
- Architecture tests stay green (no `typeorm`/`@nestjs/*` in `domain/`/`application/`).
