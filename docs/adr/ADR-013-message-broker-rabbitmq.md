# ADR-013: Message broker — RabbitMQ

- **Status:** Accepted
- **Level:** Software (C4 Level 2 · Container)
- **Date:** 2026-10-04

**Context.** Rules S-5/S-6 of `ARCHITECTURE.md` require integration events to be published through a transactional outbox and consumed idempotently with a dead-letter queue after N retries, but no concrete broker technology is named anywhere in the existing ADRs (ADR-003 only fixes the *integration style*: messaging). The global rule G-1 forbids introducing a message broker without a dedicated ADR. This record is that ADR.

Decision drivers: Performance, Cost efficiency, Scalability, Security & Privacy, Modifiability, Testability, Interoperability, Time-to-market, Availability, Deployability.

Context notes: Team of 6, 6-week MVP, low infrastructure budget, 10,000 concurrently active users at MVP scale. Event volume is modest (booking, verification, wallet, and notification events), but consumers must survive restarts and the main flow must not make synchronous calls to external systems (ADR-006, fitness function ADR-006).

**Options considered.**

| Driver | Weight | RabbitMQ | Kafka |
| --- | --- | --- | --- |
| Performance | 3 | 4 | 5 |
| Cost efficiency | 3 | 5 | 3 |
| Scalability | 2 | 4 | 5 |
| Security & Privacy | 2 | 4 | 4 |
| Modifiability | 2 | 4 | 3 |
| Testability | 2 | 5 | 3 |
| Interoperability | 2 | 5 | 4 |
| Time-to-market | 2 | 5 | 3 |
| Availability | 1 | 4 | 5 |
| Deployability | 1 | 5 | 3 |
| **Weighted total (/5)** | | **4.50** | **3.80** |

**Decision.** Adopt **RabbitMQ** (3.x, AMQP 0-9-1) as the message broker. One topic exchange `skillswap.events`; each consumer owns a durable queue bound by routing keys it cares about. Publishers never touch the broker directly: they write outbox rows in the same transaction (S-5), and a relay in `apps/api` drains the outbox and publishes. Each queue has a `.retry` queue (TTL + dead-letter back) and a `.dlq` terminal queue (S-6); consumers deduplicate on `messageId` before applying side effects.

**Rationale.** RabbitMQ was chosen because the workload is classic task/event distribution at modest volume, not an event log. It is strong on the priority drivers: Cost efficiency, Testability, Time-to-market, Deployability — it runs as a single container in dev/CI, ships a management UI, and needs no partition/rebalance operational model from a 6-person team. Compared with Kafka: higher weighted score (4.50 vs 3.80); Kafka wins on raw throughput and log replay, but neither is required by any quality-attribute scenario — the platform's 10k-user MVP emits low event volumes, and replay-from-beginning is not a stated requirement. RabbitMQ's per-queue buffering and built-in dead-lettering map directly onto rules S-5/S-6 without extra infrastructure.

**Consequences.**

- (+) Transactional outbox keeps business transactions independent of broker availability (ADR-006: no sync calls in the main flow)
- (+) Per-consumer queues let modules scale independently; DLQ + retry come out of the box
- (+) Single Docker container for local dev and CI; management UI aids debugging
- (−) At-least-once delivery forces every consumer to deduplicate (`processed_events` table) — enforced in tests
- (−) No built-in log replay; if a future requirement needs event sourcing/audit replay, swap to Kafka under a new ADR (rule G-1)
- (−) The broker becomes an availability dependency of the *asynchronous* path only; producers keep working while it is down (verified by ADR-003's shut-down test)

**Verification.** Integration test: stop RabbitMQ, commit business transactions — they must succeed (outbox rows accumulate); restart RabbitMQ — all outbox rows are published and consumed exactly once after deduplication; poisoned messages land in the DLQ after N retries. Architecture test: no module outside `apps/api/src/shared/messaging` imports `amqplib` (publishers go through the outbox only).
