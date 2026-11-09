
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

---

## Amendment B — one queue per module, not per event type (2026-11-09)

**Status:** Accepted — implemented by `docs/plans/2026-11-09-module-scoped-queues-plan.md`.

**Context.** The consumer declared **three durable queues per registered handler** (`rabbit-consumer.ts`:
the main queue, `${queue}.retry` with a 5 s TTL, and `${queue}.dlq`), and modules registered one
queue per (module, event type). Five consuming modules produced 39 registrations, so a boot
declared **39 × 3 = 117 queues**. Reproduced against the local stack and confirmed against
CloudAMQP's management API on the project's own instance.

CloudAMQP's free shared plan refuses to declare more than **100 queues per instance**, so
`assertQueue` began failing. `onApplicationBootstrap` does not await the broker, so the API still
booted and served HTTP while every consumer looped on `BrokerUnavailableError`. The symptom was
therefore silent: no wallet settlement, no inbox rows, no audit rows, no trust projection.

**Decision.** A queue is a **consumer endpoint**, so the queue is keyed by **module**:

1. **Queue name is the module name, verbatim** (`account-profile`, `admin-operation`, `live-class`,
   `skill-verification`, `wallet-ledger`). It is simultaneously the AMQP queue, the module's
   `MODULE_NAME`, and the `consumerId` half of the `processed_events` primary key. `ADMIN_OPERATION`
   etc. are `MODULE_NAME` constants, so the three cannot drift.
2. **One queue binds many routing keys.** `EventHandlerRegistration` carries `eventTypes: readonly
   string[]`; `assertTopology` declares the three queues once and then binds each key.
3. **A routing key may map to several handlers, and must.** `account-profile` projects a
   verification's status *and* writes an inbox row from the same event. Merging those into one
   handler would have silently dropped a notification, so `register` appends handlers per key.
4. **Dispatch is all-or-nothing.** Every handler for an event runs before the message is acked.
   A partial success would mark the event `DONE` for a consumer that never applied it; the sibling
   that did run is already required to be idempotent, so re-running it is safe.
5. **The retry queue dead-letters to its own module queue** via the default exchange
   (`x-dead-letter-exchange: ""`, `x-dead-letter-routing-key: <module>`), not to the topic exchange.
   It previously baked the event type into `x-dead-letter-routing-key`, which cannot vary per
   message once one retry queue serves many event types. Returning the message to the queue that
   failed it, and dispatching again by the envelope's `eventType`, is where the type already lives.
6. **An event type with no handler on the queue it was bound to is a permanent failure**, not a
   silent ack. Acking would report success for work nobody did.

Declared queues: **15** (5 modules × main/retry/dlq), independent of load.

**Rejected — lazy-asserting the retry and DLQ queues.** It reduces the count at rest to 39 but
leaves the ceiling at 117, and it creates the extra 78 queues precisely during an incident, when
declarations are already failing. Worse, the retry queue deliberately has **no consumer** so
messages sit for the TTL, which makes `x-expires` a message-dropping hazard that cannot be verified
without the live broker's behaviour. A design that only holds while nothing goes wrong is not a fix.

**Rejected — a dedicated CloudAMQP plan.** It removes the limit and is the cleanest operational
answer, but it is not free, and the deployment constraint is permanent free tier.

**Consequences.**

- (+) Declared queues fall 117 → 15, with headroom under the free-plan limit that survives any
  failure burst.
- (+) The topology now matches what ADR-031 §4 already describes for notifications, and what
  `tasks/mobile-contracts.md` draws. The implementation had drifted; this returns it to the
  documented design.
- (+) `event-handler-registry` gets simpler: one map keyed by module, with routing keys inside.
- (−) **`processed_events` and watermark keys change.** The stored id is `${consumerId}:${eventId}`
  and the watermark key is `${consumerId}:seq:${aggregateId}`; `consumerId` is the queue name.
  Merging orphans every existing dedup row, so the dedup window resets. The durable guarantee is
  unaffected — the outbox row is still the record — and the sequence guard absorbs the realistic
  redelivery window, but a redelivery spanning the deploy could apply an event twice. Handlers are
  idempotent, so this degrades to no more than a duplicate no-op.
- (−) Intra-module head-of-line blocking: one slow handler now delays its siblings. Cross-module
  isolation, which is what failure domains are for, is preserved. `CONSUMER_PREFETCH` (20) was
  already shared per channel, so the isolation removed was largely nominal; the old topology
  implied 39 × 20 = 780 unacked messages in a 512 MB container, which was never real.
- (−) The queue name is now load-bearing in three places at once (AMQP queue, `MODULE_NAME`,
  `consumerId`). Renaming a module later is a migration.

**Verification.**

| Claim | Evidence |
|---|---|
| Boot declares three queues per module, not per handler | `rabbit-consumer.spec` — "declares three queues per module, not per handler" (5 modules → 15 `assertQueue` calls) |
| Every routing key of a module binds to its one queue | `rabbit-consumer.spec` — "binds every routing key of a module to its one queue" |
| One `consume` per module | `rabbit-consumer.spec` — "consumes one queue per module" |
| A retried event returns to its own module queue | `rabbit-consumer.spec` — "dead-letters a retried event back to its own module queue" |
| Two handlers for one event type both run, in order | `event-handler-registry.spec` — "keeps two handlers for the same event type, in registration order" |
| A handler cannot be registered twice for one event type | `event-handler-registry.spec` — "rejects the same handler registered twice for one event type" |
| An unbound event type reaches no handler | `event-handler-registry.spec` — "returns no handlers for an event type the queue never bound" |
| Ordering still converges with one shared consumer id | `event-ordering.e2e-spec` — 5/5 against the real stack |

Two facts recorded rather than asserted:

- **The 117 → 15 reduction was observed on a broker, not inferred.** The old topology was reproduced
  at exactly 117 queues on the local stack (matching CloudAMQP's report), the local broker was
  emptied, and the new code's boot declared the 15 module queues. On CloudAMQP, after a run against
  the same instance, `/api/queues` returned 132 = 117 legacy + 15 new.
- **The 117 legacy queues still exist on CloudAMQP.** Code changes do not delete them, so the purge
  in plan phase 6 is required before the limit is actually relieved.


