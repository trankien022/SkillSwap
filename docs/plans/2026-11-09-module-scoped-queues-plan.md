---
title: Module-scoped consumer queues — collapse 117 queues to 15
type: plan
date: 2026-11-09
topic: module-scoped-queues
status: Implemented
owner: Group 4
---

# Module-scoped consumer queues — collapse 117 queues to 15

**FRs:** all consumer-driven FRs (FR-001/002/003/014/015/016) · **BRs:** BR-033 (no lost credit on retry)
**Modules:** `shared/messaging` (owner) + the 5 consuming modules
**Relates to:** ADR-013 (broker + outbox), ADR-031 (notification pipeline), ADR-010 (idempotent consumers)

---

## 0. Why

CloudAMQP's free shared plan refuses to declare more than **100 queues** per instance. On
2026-11-09 the project's account reported **117**.

That number is not leftover state. `rabbit-consumer.ts:188-197` declares three durable queues per
registered handler:

```ts
await channel.assertQueue(queue, { durable: true });                 // main
await channel.assertQueue(`${queue}.retry`, { ... });                // 5s TTL → exchange
await channel.assertQueue(`${queue}.dlq`, { durable: true });        // poison
```

and modules register **one queue per (module, event type)** handler. Counting the registrations
that actually execute at boot:

| Module | Registrations |
|---|---|
| `account-profile` | 11 |
| `admin-operation` | 12 (`AUDITED_EVENT_TYPE_LIST`) |
| `live-class` | 9 |
| `skill-verification` | 4 |
| `wallet-ledger` | 3 |
| **Total** | **39** |

39 × 3 = **117**. Deterministic on every boot; deleting the queues recreates all 117.

### Blast radius

`assertTopology` throws once the broker refuses a declaration. `connectAndConsume` wraps that as
`BrokerUnavailableError` and `scheduleRetry` loops forever. Because `onApplicationBootstrap` does
**not** await the broker (`rabbit-consumer.ts:78-82`), the API still boots and serves HTTP — while
every cross-module side effect silently stops: wallet settlement on `booking.confirmed`,
notification inbox rows, audit rows, the `live-class` trust projection.

So it is not a crash. It is a quiet loss of every event-driven feature, discovered only by reading
logs. That is the worst failure shape available, and it is the reason this is worth fixing now
rather than after the deploy.

## 1. Decisions

1. **A queue is a consumer endpoint, not a message type.** All 39 handlers live in one NestJS
   process, so 39 failure domains buy nothing: the prefetch and connection are shared anyway
   (`channel.prefetch(20)` once per process). One queue per module keeps the only boundary that
   is real — the schema boundary — and drops the rest.
2. **Queue name is the module name**, verbatim (`account-profile`). This is what ADR-031 §4 already
   specifies for notifications (`account-profile.notification-inbox`) and what
   `tasks/mobile-contracts.md:405` draws. The implementation drifted; this plan returns it to the
   documented design. The name must also equal `MODULE_NAME`, because `processed_events` rows live
   in the module's own schema and the queue name is the `consumerId` half of their primary key.
3. **One queue may dispatch to several handlers, and that is required, not incidental.**
   `account-profile` registers two handlers for the same event type today: the verification
   projection (`account-profile.module.ts:98`) and the inbox notification (`:110`), both for
   `student.verification.{approved,rejected,revoked}`. Collapsing to one queue means a routing key
   maps to a **list** of handlers. `EventHandlerRegistry.register` therefore appends.
4. **A dispatch failure fails the whole message.** Letting one handler succeed while its sibling
   throws would leave `processed_events` marked `DONE` for an event one consumer never applied.
   All-or-nothing is at-least-once and therefore correct; the cost is re-running the successful
   sibling, which is already required to be idempotent.
5. **The 5-second retry queue stays. The DLQ stays.** Both survive, one of each per module instead
   of one of each per handler.
6. **`processed_events` keys change, and the consequence is recorded, not hidden.** The stored id is
   `${consumerId}:${eventId}` (`processed-event-store.ts:39`), and `consumerId` is the queue name.
   Merging therefore orphans every existing dedup row. **The ordering watermark keys move the same
   way** (`${consumerId}:seq:${aggregateId}`, `:153`). The durable guarantee is unaffected — it
   lives in the outbox row, and the sequence guard absorbs the realistic redelivery window — but
   this is a real reset of a dedup window and it gets an ADR amendment.

**Rejected: lazy-asserting the retry/DLQ queues (the "A" option).** It lowers the count at rest to
39 but leaves the ceiling at 117, and the extra 78 queues are created precisely during an incident,
when declarations are already failing. Worse, the retry queue deliberately has **no consumer** so
messages can sit for the TTL, which makes `x-expires` a message-dropping hazard that cannot be
verified without the live broker. A design that is only safe while nothing goes wrong is not a fix.

## 2. Phases

Each phase is its own commit and leaves the tree green.

### Phase 1 — registry maps a routing key to a list (`refactor(messaging)`)

- `event-handler-registry.ts`:
  - `EventHandlerRegistration` loses `queue` and gains `eventTypes: readonly string[]`.
  - Internals become `byQueue: Map<queue, { moduleName, handlers: Map<eventType, EventHandler[]> }>`.
  - `register()` appends to the handler list for each event type; a duplicate exact handler for the
    same (queue, eventType) pair is still an error, so a copy-paste cannot double-deliver.
  - New accessors for the consumer: the queue list with their routing keys, and a lookup of the
    handlers for a delivered event type.
- `event-handler-registry.spec.ts`: assert two event types under one queue are one entry; two
  handlers for one event type coexist and both are returned in registration order; a duplicated
  (queue, eventType, handler) registration throws.

**Done when:** `pnpm --filter @skillswap/api test event-handler-registry` is green and no module has
been touched yet.

### Phase 2 — consumer declares one queue per module (`refactor(messaging)`)

- `rabbit-consumer.ts`:
  - `assertTopology` declares the module queue, `${queue}.retry`, `${queue}.dlq` **once per queue**,
    then `bindQueue(queue, EVENT_EXCHANGE, eventType)` for each routing key.
  - The `consume` callback dispatches on `parsed.eventType` through the registry instead of using a
    captured single registration.
  - `onMessage`/`handle`/`classify`/`sendToRetry`/`sendToDlq` take the queue name; the retry and
    DLQ routing is per queue, so a message that fails finds its module's infrastructure.
  - `runOnce` receives the queue name as `consumerId` (unchanged signature, new value).
  - **Do not change the retry queue's `x-message-ttl` or its dead-letter routing key**: it
    dead-letters to `eventType`, which the topic exchange routes back to the module queue.
- `rabbit-consumer.spec.ts`: boot asserts **one** main queue per module, plus `.retry` and `.dlq`,
  and one `bindQueue` per routing key; a message for an unbound event type is not dispatched; a
  throwing handler takes the message to the retry queue of its own module.

**Done when:** the consumer tests prove the declaration count, and a fake connection sees
`3 × modules` `assertQueue` calls rather than `3 × handlers`.

### Phase 3 — point the five modules at their own queue (`refactor(modules)`)

Each `handlers.register({ queue: '<module>.<event>', ... })` becomes
`handlers.register({ eventTypes: [...], ... })`, with adjacent registrations merged:

| Module | Before | After |
|---|---|---|
| `account-profile` | 11 registrations | **1** |
| `admin-operation` | 12 (loop) | **1** |
| `live-class` | 9 | **1** |
| `skill-verification` | 4 (loop) | **1** |
| `wallet-ledger` | 3 | **1** |

The handlers themselves do not move. The existing switch-inside-a-handler shape (`describeAuditedAction`,
`live-class` payment routing) already tolerated many event types per handler, so merging is a wiring
change, not a rewrite. Where one event type had two handlers (`account-profile`),
both are registered against the same type and both run.

**Done when:** `pnpm test` green for those five modules.

### Phase 4 — fix the suites that name a queue (`test(api)`)

Queue names are used as fixtures in two places, both of which must move because the name is now the
module:

- `apps/api/src/modules/account-profile/account-profile.notification-registrar.spec.ts` looks
  handlers up by `queue` — switch to lookup by event type.
- `apps/api/test/event-ordering.e2e-spec.ts` seeds and asserts `processed_events` rows under
  `live-class.student-verification-approved` etc. — switch to `live-class`.
- `processed-event-store.spec.ts` passes a queue-shaped `consumerId`; keep the values (the store is
  agnostic) but add a case asserting two handlers on one `consumerId` dedupe independently by
  `eventId`.

**Done when:** `pnpm --filter @skillswap/api test` is green.

### Phase 5 — record the decision (`docs`)

- `docs/adr/ADR-013-…md`: **Amendment B — one queue per module**, stating the count arithmetic, the
  rejected lazy-assert option and why `x-expires` is unsafe on a consumer-less retry queue, the
  all-or-nothing dispatch rule, and the `processed_events`/watermark key reset with its blast radius.
- `docs/adr/ADR-031-…md`: note that `account-profile.notification-inbox` is now simply
  `account-profile`; the pipeline described there is unchanged.
- This plan stays as the record of the migration.

**Done when:** both ADRs describe the shipped topology.

### Phase 6 — purge the old queues from the broker (`chore`)

The 117 durable queues already exist; code changes do not delete them. `scripts/purge-legacy-queues.mjs`
(`pnpm queue:purge-legacy`) uses the CloudAMQP management API to remove queues named
`<module>.<something>` and their `.retry`/`.dlq` siblings, where `<module>` is one of the five
consuming modules. It is **dry run by default** (`--apply` to delete), never touches the 15 module
queues, and **skips any queue holding messages** unless `--force-drain` is passed.

The dry run against the project instance reported exactly 117 legacy queues, 15 module queues, and
21 legacy queues holding messages — those messages are work that was never done and must be
inspected before deletion, which is why they are not drained automatically.

**Done when:** a dry run lists exactly the 117 legacy names and nothing else, and the operator has
decided what to do about the 21 non-empty ones.

### Phase 7 — full gate (`chore`)

`pnpm verify`, then confirm the declared count on the broker is 15 and that a booking still settles.

Observed on 2026-11-09: `pnpm verify` exit 0 (1,187 api + 446 web + 251 contracts + 37 gateway +
262 mobile tests, arch clean). The old topology was reproduced at exactly **117** queues on the
local stack, the broker was emptied, and the new code's boot declared **15**. On CloudAMQP the
management API then reported 132 = 117 legacy + 15 new.

**Done when:** `pnpm verify` exits 0 and a broker listing shows five module queues plus their
`.retry`/`.dlq`.

## 3. Out of scope

- **Moving to a dedicated CloudAMQP plan.** It removes the limit but is not free, which the project
  constraint forbids.
- **Per-module `prefetch` tuning.** All five queues share one channel and therefore one prefetch
  value. Splitting into five channels is a separate change with its own trade-offs.
- **The `Database unavailable — start it with "docker compose up -d"` message** in
  `module-registry` / relay / consumer logs. It is misleading on a managed host and wants its own
  fix, but it is unrelated to queue topology.
- **Replaying messages stranded in the old `.dlq` queues.** They are examined during Phase 6's dry
  run; anything real is replayed by hand before deletion.

## 4. Risks

- **A slow handler now delays its module's siblings.** Accepted: the prefetch is already shared, so
  the isolation this removes was largely nominal. Cross-module isolation, which is what the failure
  domains are for, is preserved.
- **`processed_events` and watermark keys reset.** Documented in Amendment B. The outbox row remains
  the durable record; the risk window is a redelivery during the deploy.
- **A deployment where old and new code both run.** An old instance would declare the 39 legacy
  queues and a new one the 5 module queues; both would consume, so events would be handled twice
  across the mixed window. Handlers are idempotent, but the deploy should still be a single
  instance replacement rather than a rolling overlap.
- **The queue name is now load-bearing.** It is simultaneously the AMQP queue, the `MODULE_NAME`,
  and the `consumerId` in `processed_events`. A rename later is a migration; this is why the plan
  names that coupling explicitly instead of leaving it implicit.
