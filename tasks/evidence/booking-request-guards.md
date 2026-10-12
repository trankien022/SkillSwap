# T09 phase A request guards — 12 October 2026

- Idempotency replay requires both original learner and class in the application lookup and persistence race path. Collision returns generic HTTP409 with no original booking identity. Same caller/class/key still replays exactly once.
- INSERT ON CONFLICT for the globally unique key permits a post-conflict lookup in a valid transaction. Removed worker code that attempted a new SELECT after a failed INSERT, when PostgreSQL would already have aborted the transaction.
- Confirmation UPDATE checks pending state and hold expiry using database now(), under the owner-scoped row lock. Expired holds yield confirmed=false with no confirmation outbox event, even before the expiry job changes state.
- Focused book use-case/persistence tests passed as part of 24 backend tests including nullable status; API build/typecheck/scoped lint and architecture591 modules1756 dependencies passed.
- Strict Gateway two-account probe passed: original replay, cross-owner/key collision, same-owner/different-class collision, expired-hold denial and zero confirmation outbox rows. Removed disposable bookings/classes after probe.
- Payment settlement boundary remains unresolved in phases B-D of tasks/payment-boundary-review.md. These guards do not establish financial confirmation correctness; do not close T09 or claim paid-booking acceptance.
