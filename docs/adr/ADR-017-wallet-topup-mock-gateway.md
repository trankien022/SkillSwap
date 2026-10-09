# ADR-017: Wallet top-up — mock gateway, signed callback, idempotent ledger

- **Status:** Accepted
- **Level:** Software (C4 Level 3 · Component)
- **Date:** 2026-10-09

**Context.** FR-008 requires that a user funds their SkillSwap wallet with real money and that credits are added exactly once. The wallet has a ledger (`ledger_entries`) but no balance, no top-up path, and no callback ingestion. OQ-011 (payment-gateway selection) and the chargeback half of OQ-006 are unapproved, which the SRS marks as blocking implementation.

Constraints in play: money is integer VND (1 credit = 1,000 VND), never floats; only TypeORM in `internal/adapter/out/persistence/` (ADR-014), one schema per module with no cross-schema FKs; cross-module coordination is via the transactional outbox plus idempotent consumers (ADR-013); the module already writes ledger entries idempotently by a unique key.

**Decision.**

1. **Gateway is a port, not a vendor.** The MVP integrates a **development/mock payment gateway** behind a `PaymentGateway` outbound port. No real provider is selected; OQ-011 is resolved *for the MVP increment* by deferring vendor choice to a later swap of the adapter. The port contract is: `initiateTopUp` returns provider payment parameters; the inbound webhook is `{ providerRef, amountVnd, status, signature }`.
2. **Callback authenticity.** Webhooks are verified with an **HMAC-SHA256 signature** over the raw body using a shared secret (`PAYMENT_WEBHOOK_SECRET`), rejecting missing/mismatched signatures with 401. A timestamp/replay window is enforced.
3. **Idempotency and ordering.** Each top-up creates a `top_up_intents` row keyed uniquely on `(provider, provider_ref)`. A callback is applied at most once; a callback whose status rank is older than the stored rank is **acknowledged but ignored** (AC-009). Applying a callback credits the wallet and writes a ledger entry in one DB transaction.
4. **Reversal (chargeback, OQ-006 partial).** A valid reversal posts an **offsetting debit** ledger entry carrying the original reference and a trace id. A reversal may leave the wallet in deficit: the deficit is recorded, further debits (spending) are blocked while `available_credits < 0`, and recovery happens by later top-ups. The *income-release timing* half of OQ-006 is out of scope here and remains for FR-009.
5. **Balance.** `wallets.available_credits` (and `pending_credits`, unused until FR-009) is materialized and updated in the same transaction as its ledger entry; reads must reconcile to the ledger sum (FR-010 read side).
6. **Account state (OQ-005 partial).** Only `active` accounts may top up; suspended accounts are rejected.

**Rationale.** A gateway port with a mock adapter lets FR-008 ship and be tested end-to-end (signature verification, replay, monotonic ordering, reversal) without committing to a vendor or handling real money. HMAC-on-raw-body with a monotonic status rank are the standard controls for exactly-once webhook effects and directly satisfy the FR-008 acceptance criteria and AC-009. Materializing the balance in the same transaction as the ledger entry keeps reads simple while the FR-010 read side can still prove history == balance.

**Consequences.**

- (+) FR-008 is implementable and testable now; a real provider is a later adapter swap behind the same port.
- (+) Replay/out-of-order callbacks and reversals are provably safe; AC-009 is covered.
- (−) The `available_credits` column can drift from the ledger if a future code path forgets the invariant — mitigated by a reconciliation query and the FR-010 read side.
- (−) Negative balances (deficit) are a real state that spending paths must respect.
- (−) Deferred: real provider integration, payout/withdrawal (FR-014), and the income-release half of OQ-006.

**Verification.**
- Unit: signature reject; replay credits once; older callback acknowledged but not applied; reversal writes an offsetting entry with a trace id; suspended account rejected.
- Integration: `top_up_intents` unique key prevents double credit; balance equals ledger sum after a mixed sequence.
- Architecture tests stay green (no `typeorm`/`@nestjs/*` import in `domain/`/`application/`).
