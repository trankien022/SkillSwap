---
title: W2 — Outbox and event-delivery reliability
type: plan
date: 2026-10-24
topic: w2-outbox-reliability
status: Proposed
owner: Group 4
---

# W2 — Outbox and event-delivery reliability

**Parent:** [`2026-10-24-fr-completion-master-plan.md`](2026-10-24-fr-completion-master-plan.md)
**FRs (indirectly every event-driven FR):** FR-008, FR-009, FR-016, FR-018, FR-019, FR-020
**Modules:** `apps/api/src/shared/messaging` (only place broker access lives — ADR-013), all producers
**Priority:** P0 — every notification, projection and settlement depends on this path.
**ADR:** amends **ADR-013** §"Outbox relay"; no new ADR.

---

## 0. What is actually wrong

### D1 — An unclassified publish error marks events `DEAD` instead of retrying

`shared/messaging/outbox-relay.ts` `processBatch()`:

- `BrokerUnavailableError` → returns `broker-down`, rows stay `PENDING`. Correct.
- **Any other error** (a serialisation fault inside `publish`, an unhandled channel error, a transient socket reset surfaced as a different type) → `recordAttemptStatement()` increments `attempts` for every claimed row and flips them to `DEAD` once `attempts >= maxDeliveryAttempts`.

So a transient fault that is merely *not the expected class* burns all attempts of a batch and permanently strands those events. Their effects never happen: a `wallet.transaction.completed` never becomes a notification, a `student.verification.approved` never reaches the trust projection, a `booking.cancelled` refund notice never arrives.

### D2 — Nothing ever replays `DEAD` rows

There is no dead-letter inspection, no counter, no metric, no admin endpoint, no log line worth alerting on (one `warn` per row). A `DEAD` row is silent data loss with a row in the table nobody reads.

### D3 — The consumer dedup store is not co-located with the consumer's effect

`shared/messaging/processed-event-store.ts` marks an event processed. If that mark commits **before** the handler's own write commits (or in a different transaction), a crash in between makes the event look processed while its effect was lost — the mirror image of double-delivery. The handler contract (`event-handler-registry.ts` `EventHandler`) has no way to express "run this inside my transaction".

### D4 — Ordering is per-outbox-row and not stated

`claimPendingStatement` orders by `created_at, id` and is `SKIP LOCKED`. Two relay instances (or overlapping ticks) can publish row N+1 before row N, so a consumer can see `booking.cancelled` before `booking.confirmed` for the same booking. Handlers that assume order will misbehave under load. This may be acceptable — but it must be **recorded**, not implied.

---

## Phase 0 — Conflict resolution gate (**developer interference required**)

> **STOP.** W2 changes `shared/messaging`, which ADR-013 defines as the modules' public vocabulary. None of it may be coded before the rows below are closed in an ADR-013 amendment.

| # | Conflict | Rules in tension | Decision owner | Blocking? | How it is closed |
|---|---|---|---|---|---|
| C1 | **Is at-least-once enough, or must ordering be guaranteed?** | ADR-013 (idempotent consumers, at-least-once) vs. observed behaviour (a `booking.cancelled` seen before `booking.confirmed` produces a misleading notification) | Engineering + Product Owner | **YES — blocks Phase 5** | (a) declare no ordering and require order-tolerant consumers; (b) partition the exchange by aggregate id; (c) per-aggregate sequence numbers. Recommendation: **(a)** — it is what ADR-013 already implies and needs no infra |
| C2 | **What counts as "non-retryable"?** | BR-032 (idempotent top-up) and BR-033 (no lost credit on retry/timeout) vs. a publisher that cannot distinguish a poison payload from a socket reset | Engineering | **YES — blocks Phase 2** | Enumerate the retryable set (`BrokerUnavailableError`, `ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED`) and the non-retryable set (payload that fails schema validation at publish time). A wrong classification either loops forever or loses events — both violate BR-033 |
| C3 | **Who may replay a dead letter?** | NFR-009 (privileged actions authorised server-side) + FR-015 (audited privileged actions) vs. an operator needing to unstick a run | Product Owner + Admin | **YES — blocks Phase 3** | Admin-only, audited, single-row replay. If maker/checker is required, that is a second approval step and a bigger change |
| C4 | **Retention of `DEAD` rows** | OQ-008 precedent ("keep", no deletion in MVP) | Product Owner | No | Confirmed: keep. Recorded so nobody adds a purge job |
| C5 | **`next_attempt_at` or attempt-count only?** | ADR-014 (per-module schema) vs. six new migrations for one column | Engineering | No — engineering call | The plan recommends `next_attempt_at` and states the migration cost; either is correct |

**Already resolved — do not reopen:** broker placement in `shared/messaging`, the exchange `skillswap.events`, the outbox-per-schema model, idempotent consumers. Changing any of them is a new ADR, not a fix.

**Exit criteria:** the ADR-013 amendment is merged with C1–C3 decided and C4–C5 recorded.

**Commit:** `docs(adr): amend ADR-013 with outbox error classification and dead-letter policy`

---

## Phase 0b — Reproduce and measure

**Goal:** show D1 exists and _measure_ D3/D4 instead of asserting them.

1. `outbox-relay.spec.ts`: make `publisher.publish` throw a generic `Error` for a batch; assert current behaviour (rows → `DEAD` after N ticks, never published).
2. D3: read the `processed-event-store` call sites and the `BusMessage` handler contract; write down, per handler, whether the mark and the effect share a transaction. Change nothing.
3. D4: enumerate `handlers.register(...)` across all modules and classify each as order-sensitive or not.
4. Measure `SELECT status, count(*) FROM <schema>.outbox_messages GROUP BY status` on a real run and record the numbers.

**Exit criteria:** a failing test for D1, an inventory table for D3/D4, and the measured numbers.

**Commit:** `test(shared): reproduce outbox dead-lettering on transient errors`

---

## Phase 1 — Retry-safe publishing (D1, after C2)

1. `shared/messaging/outbox-relay.ts`:
   - extract `isRetryablePublishError(error): boolean`;
   - only `!isRetryable` increments attempts to `DEAD`;
   - retryable errors leave rows `PENDING`, record `last_error` and the new timestamp without incrementing past the limit (or increment with a much larger ceiling and add backoff by `next_attempt_at`).
2. `shared/messaging/outbox-statements.ts`: add `next_attempt_at` and a `markRetryStatement`, and make `claimPendingStatement` filter `WHERE status='PENDING' AND (next_attempt_at IS NULL OR next_attempt_at <= now())`.
3. Migration in `shared` (or wherever the outbox table migration lives) adding `next_attempt_at timestamptz`. **Additive only** — the outbox table is per-schema, so the migration runs per module; follow the existing per-module migration pattern.

**Tests:** generic error → still `PENDING`, no attempt burn; explicit non-retryable → `DEAD` immediately; backoff increases; broker-down still short-circuits the whole tick.

**Commit:** `fix(shared): classify outbox publish errors before dead-lettering`

---

## Phase 2 — Dead-letter visibility and replay (D2, after C3)

1. `shared/messaging/dead-letter-reader.ts`: a port reading `DEAD` rows (schema-scoped, capped, cursor-paginated per NFR-014).
2. Admin surface: extend the existing `admin-operation` module (ADR-034 already owns operator reads) with `GET /operations/outbox-dead-letters` and `POST /operations/outbox-dead-letters/:id/replay` — **admin-only**, replay resets `status='PENDING'`, `attempts=0`, and writes an audit row (`oldState/newState` whitelisted scalars only).
3. Log one structured `error` per dead-letter transition (module, event type, row id) so an operator can alert on it.
4. Optional but cheap: a `GET /health` field counting `DEAD` rows — health is exempt from the envelope (NFR-013).

**Tests:** repository, controller (403 for non-admin), replay is idempotent (replaying a `PENDING` row is a no-op), audit row written.

**Depends on:** W4 (if audit actor attribution lands first, replay should record the operator as actor; otherwise `actorId: null` and the row records `action: 'outbox.dead_letter.replayed'`).

**Commit(s):** `feat(admin-operation): expose and replay dead-lettered outbox events`

---

## Phase 3 — Consumer transactionality (D3)

Only if Phase 0b shows a gap.

1. Change the handler contract so a handler may participate in a transaction: `EventHandler = (message, tx?) => Promise<void>` **or** add a `handlerWithUnitOfWork` variant that receives a `EntityManager`. Prefer the second (no optional-parameter ambiguity).
2. Move the processed-event mark inside that same transaction for every handler that writes to its own schema.
3. For handlers whose effect is in another module's schema (currently none — each consumer writes only its own schema, per ADR-014), keep the existing at-least-once + idempotent-key approach and document the residual window.

**Tests:** a handler that throws after writing must roll back both the effect and the processed mark; a re-delivery after a crash lands exactly once.

**Commit:** `fix(shared): commit the processed-event mark with the consumer effect`

---

## Phase 4 — Ordering guards where needed (D4, after C1)

C1 was answered **(c): per-aggregate sequence numbers**, so this phase is not the per-consumer
`occurredAt` comparison originally sketched here. Last-writer-wins by `occurredAt` stays as each
projection's own rule; it is no longer what orders delivery, because a replayed `DEAD` row can
carry a correct timestamp and still arrive after a newer one.

What shipped, all inside `shared/messaging` so no handler can forget it:

- **Stamp at insert.** `insertOutboxStatement` allocates `COALESCE(MAX(sequence), -1) + 1` grouped
  by the aggregate id lifted from `bookingId` / `classId` / `accountId` / `transactionId` — inside
  the writing statement, so two concurrent writers cannot receive the same number.
- **Carry on the wire.** `BusMessage.sequence`; `parseEnvelope` tolerates its absence, because
  rows written before this phase are still deliverable and a missing sequence means "oldest",
  never "invalid" (E8: emitters first, consumer strictness last).
- **Guard in the store.** `PostgresProcessedEventStore.runOnce` ignores an event whose sequence is
  below the watermark it has already applied for that aggregate, recording it `DONE` rather than
  leaving it pending forever. The watermark is a `DONE` row in `processed_events` keyed
  `<queue>:seq:<aggregateId>`, written only **after** the handler, so a failed handler cannot
  advance it.
- **Schema.** Two migrations × seven schemas: `outbox_messages.aggregate_id`/`sequence` (nullable,
  with `ix_outbox_messages_aggregate`) and `processed_events.sequence` (nullable).

An aggregate with no watermark has seen nothing, so its first event always applies — and
`loadWatermark` returns `undefined`, not `null`, for that state. Collapsing the two silently
disables the guard for every consumer; that bug was found by the E2E below and is pinned by it.

**Tests:** `test/event-ordering.e2e-spec.ts` delivers sequence 2 then sequence 1 through one real
consumer and asserts the stale state is not applied, a genuinely newer change still is, an
unstamped first event is honoured, and sequences are independent per aggregate. Verified by
disabling the guard: 3 of its 5 cases fail. `test/room-idle-payment.e2e-spec.ts` proves the money
path (`room_idle` → Teacher paid 45 credits, nothing left pending) and the admission refusals.
`test(spec-guards)` — each module now carries its own migration-registration guard, because module
isolation forbids `bootstrap/` from reaching module internals.

**Commit:** `feat(shared): order events per aggregate on the outbox`

---

## Phase 5 — Close the loop

- `docs/adr/ADR-013` verification section: list the new tests.
- `tasks/todo.md` T18/T19 acceptance notes: reference the dead-letter read as the evidence channel.
- `AGENTS.md` "Events" hard rule: add one line — "never mark an event `DEAD` on an unclassified error" (docs-only change, allowed).

**Commit:** `docs(adr): record outbox reliability verification`

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| **A developer "fixes" the dead-lettering without C2 decided** and silently changes what counts as poison | **High** — this is the failure mode this rewrite removes | Phase 0 gate is mandatory; the ADR names both error sets before Phase 1 |
| Per-module migration for `next_attempt_at` multiplies migration files | Certain (7 schemas) | Accept it — ADR-014 forbids a shared table; write them in one commit |
| Backoff makes the demo look "stuck" during a broker outage | Medium | Backoff cap small (≤ 30 s in dev via config), documented |
| Transactional handler change touches every consumer | Medium | Do it module by module in Phase 3, each with its own test |
| Admin replay endpoint becomes a privilege-escalation path | Low | Admin-only, audited, and it can only re-publish rows that already exist (C3) |

## Decisions required (summary) — **3 of 5 open**

| Decision | Owner | Status |
|---|---|---|
| C1 — ordering guarantee or order-tolerant consumers | Engineering + Product Owner | **OPEN** — default: declare no ordering |
| C2 — retryable vs non-retryable classification | Engineering (ADR-013 amendment) | **OPEN** — default: only schema-validation failures are terminal |
| C3 — who may replay a dead letter | Product Owner + Admin | **OPEN** — default: admin-only, audited, single row |
| C4 — `DEAD` retention | Product Owner | Closed — keep forever in MVP |
| C5 — backoff column | Engineering | Closed — `next_attempt_at` |

These are engineering calls with recorded defaults (Appendix A.2/A.4 of the master plan): a developer may adopt the default and record it in the ADR-013 amendment; the Product Owner may override. **They are the last P0 gate in the programme.**

## Definition of done

- The ADR-013 amendment is merged **before** Phase 1 starts.
- A transient publish failure no longer strands events (test proves it).
- `DEAD` rows are countable, readable and replayable by an admin, with an audit row.
- Consumer double-effect window closed or documented with a test.
- `pnpm verify` green.
