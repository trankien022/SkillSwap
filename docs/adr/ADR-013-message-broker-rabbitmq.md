
---

## Amendment A — publish-error classification, dead-letter replay, ordering (2026-10-25)

**Status:** Accepted — resolves W2 C1/C2/C3 of the FR completion programme
(`docs/plans/2026-10-24-w2-outbox-reliability-plan.md`).

**Context.** Three defects made the "at-least-once" guarantee weaker than this ADR
claims. The read path (`rabbit-consumer.ts`) already classifies failures, but the
**publish** path never did:

1. `outbox-relay.ts` treats every error that is not `BrokerUnavailableError` as a
   publish failure against the row.
2. `outbox-statements.ts#recordAttemptStatement` increments `attempts` and flips the
   row to `DEAD` at `MAX_DELIVERY_ATTEMPTS` (default 5).
3. A `DEAD` row has **no replay path** — it is unreachable except by hand-written SQL.

Together these mean a transient socket reset destroys an event permanently. That
violates BR-033 ("no lost credit on retry or timeout") for any event carrying money.

### C1 — Ordering: per-aggregate sequence numbers

**Decision (2026-10-25):** the broker still guarantees **no global ordering**. Every
event carries a monotonically increasing, **per-aggregate** sequence number; a consumer
that has already applied a higher sequence for that aggregate must ignore the lower one.

Rejected alternatives:

- *Declare no ordering and make every consumer order-tolerant* — cheapest, but it
  leaves the ordering rule as an unwritten convention that each new consumer must
  rediscover. This programme exists because such conventions silently rot.
- *Partition the exchange by aggregate id* — RabbitMQ does not partition a topic
  exchange; it would mean swapping the broker, which rule G-1 forbids without a new ADR
  and which the original comparison already rejected on cost and operational grounds.

**Deploy hazard and the mitigation.** A required envelope field is a breaking change.
Per E8 (emitters first, consumer strictness last) the sequence is: emitters stamp →
consumers read tolerantly → consumers enforce. A **missing** sequence is treated as
"older than anything already known", **never** as invalid. Rows written before this
amendment therefore remain deliverable — dropping historical events while fixing a
dropped-event bug would defeat the purpose.

### C2 — Retryable versus terminal

**Decision (2026-10-25):** only a **schema-validation failure at publish time** is
terminal. Everything else is retryable.

The retryable set **reuses `isTransient`** from `rabbit-consumer.ts`
(`ModuleNotInitialisedError`, `BrokerUnavailableError`, and errno codes matching
`/^(ECONN|EPIPE|ETIMEDOUT|08|57)/`) and extends it with every error the relay cannot
prove to be a payload defect.

The asymmetry is deliberate: retrying a poison payload costs log noise, while dropping
a real event costs money. Only a failure that is provably the payload's fault may burn
a row to `DEAD`.

### C3 — Who may replay a dead letter

**Decision (2026-10-25):** an **Administrator only**, **audited**, **single row**.

`GET /operations/outbox-dead-letters` (read) and
`POST /operations/outbox-dead-letters/:id/replay` (reset `status='PENDING'`,
`attempts=0`), both behind the existing `admin` role from ADR-030, each replay writing
one audit row with whitelisted scalars (ADR-034). Maker/checker is **not** adopted: with
C2 in place a `DEAD` row means "this payload is broken", so replay volume is expected to
be near zero and an audit trail is sufficient.

After W4 lands, the replay records the operator as `actorId`; until then the row records
`action: 'outbox.dead_letter.replayed'` with `actorId: null`, which ADR-035 defines as
"legacy or unknown" rather than "system".

**Consequences.**

- (+) A transient publish failure no longer destroys an event (BR-033).
- (+) A `DEAD` row is now observable and recoverable instead of an invisible dead end.
- (−) The event envelope gains a required field; every consumer must handle its absence
  during rollout (mitigated above).
- (−) Six per-schema `next_attempt_at` migrations (one per module schema, ADR-014).

**Verification.** Each claim below names the test that would go red if it stopped being true.

| Claim | Evidence |
|---|---|
| A generic publish error leaves the row `PENDING` without burning an attempt | `outbox-relay.spec` — "does NOT burn an attempt when the error is transient (ECONNRESET)", "…unrecognised but not provably the payload", "…broker connection is unavailable" |
| Only a payload that cannot pass schema validation goes `DEAD` | `outbox-relay.spec` — "marks the row DEAD when the payload fails schema validation" |
| Backoff delays the next attempt instead of retrying on every tick | `outbox-relay.spec` — "schedules a backed-off retry instead of retrying on the next tick"; `outbox-statements.spec` — "does not claim a row that is still backing off" |
| A terminal failure still burns the attempt budget, a retryable one does not | `outbox-statements.spec` — "still lets a terminal failure burn the budget", "keeps a retryable failure away from the attempt counter" |
| An out-of-order delivery converges to the newest sequence | `event-sequence.spec` — "converges on the newest sequence regardless of delivery order"; `event-ordering.e2e-spec` — "applies the newest state even when the older event arrives last" |
| The ordering guard is real, not decorative | Disabling the guard fails 3 of the 5 `event-ordering` cases. The suite itself does not prove this; the run recorded here does. |
| Sequences are independent per aggregate | `event-sequence.spec` — "keeps the newest sequence per aggregate"; `event-ordering.e2e-spec` — "keeps sequences independent per aggregate" |
| An unstamped or aggregate-less event stays deliverable | `event-ordering.e2e-spec` — "still applies an unstamped event to an aggregate it has never seen", "leaves an event with no aggregate id deliverable instead of blocking it" |
| A replay is idempotent and writes exactly one audit row | `outbox-dead-letter.e2e-spec` — "lists a dead letter with its event body and replays it exactly once, audited" |
| A non-Administrator is refused | `outbox-dead-letter.e2e-spec` — "refuses the inbox to a non-Administrator" |

Two gaps are recorded rather than papered over:

- **No E2E covers a retry through a real broker outage.** The relay's retry path is proven at the
  unit seam (`outbox-relay.spec` + `outbox-statements.spec`), which is where the classification
  decision actually lives; an integration test that stops RabbitMQ is left to the W8 environment
  work. The claim "a transient publish failure no longer strands events" therefore rests on unit
  tests plus the SQL of `claimPendingStatement`, not on an end-to-end outage run.
- **`processed-event-store.spec` covers deduplication only.** The guard lives in the same method
  but its cases are the `event-ordering` E2E, which needs a real schema per module.

