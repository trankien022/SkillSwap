# ADR-031: Mobile delivery contracts, notification ownership and read projections

- **Status:** Accepted
- **Level:** Sub-system / Software (C4 Level 2/3)
- **Date:** 2026-10-12

**Context.** The SkillSwap MVP mobile client (`apps/mobile`, ADR-015) implements the 30-API business surface for learner and teacher workflows across 8 core resources. The existing backend provides 22 API endpoints across 7 bounded contexts, leaving 8 missing read and interaction routes: skills catalogue, class list/search, class details, my bookings, ratings, notification inbox, device registration, and device unregistration. Furthermore, FR-016 originally specified in-app notifications with optional push, but mobile delivery explicitly requires remote push notifications (iPhone iOS-first, with Android maintained) alongside in-app inbox persistence. Architectural constraints from `ARCHITECTURE.md` (ADR-005, ADR-007, ADR-009, ADR-013, ADR-014) mandate that the seven-schema separation be strictly preserved without cross-schema joins, that no framework/ORM leaks into domain/application layers, that all inter-module side effects travel through the transactional outbox over RabbitMQ, and that push delivery is durable, idempotent, and fault-tolerant.

Decision drivers: Modifiability, Security & Privacy, Testability, Performance, Scalability, Interoperability, Time-to-market.

**Options considered.**

1. *Dedicated Notification Module & Schema:* Add an 8th module (`notification`) and 8th schema (`notification`). Violates the hard 7-schema constraint (ADR-007, ADR-014) and complicates per-module database credentials.
2. *Cross-Schema SQL Joins for Projections:* Allow the live-class read models to query `account_profile` and `student_verification` tables directly. Violates ADR-007 and database role privilege boundaries.
3. *Domain Ownership Alignment with In-Process Read Projections & Durable Outbox Relay (Chosen):*
   - Place rating submission (`POST /classes/bookings/:bookingId/rating`) in `live-class`, sharing the `live_class` schema with bookings and classes.
   - Place device token management (`POST /notification-devices`, `DELETE /notification-devices/:id`), user notification inbox (`GET /notifications`), and durable push dispatch worker in `account-profile`, keeping device subscriptions bound to user accounts within `account_profile` schema.
   - Place class-start reminder scheduling in `schedule`, which evaluates upcoming start times and emits `class.reminder.due` over RabbitMQ.
   - Place catalogue lookup (`GET /skills`) in `skill-verification` using the existing taxonomy table.
   - Place marketplace search (`GET /classes`), details (`GET /classes/:id`), and learner bookings (`GET /classes/bookings/me`) in `live-class`, projecting minimal teacher identity/trust data via public events.

**Decision.**
1. **Preserve Seven Schemas:** No new schema or module is created.
   - `live-class` owns rating persistence, rating uniqueness invariants, class search, class details, and learner booking views.
   - `account-profile` owns device token registration/unregistration, inbox notification storage, and the durable push dispatch adapter.
   - `schedule` owns scheduled reminder calculations and emits reminder events 30 minutes before class start.
   - `skill-verification` exposes the public skill catalogue query.
2. **Contract Extensions in `@skillswap/contracts`:**
   - Define canonical Zod schemas for all 8 missing routes.
   - Add integration event contracts: `class.reminder.due` and `wallet.transaction.completed`.
   - Update `bookingConfirmedSchema` to include `classId` for downstream notification and scheduling consumers.
3. **Read Projections over Cross-Schema SQL:** Modules maintain local projections populated by integration events (existing trust projections are retained; public teacher display names are fetched through an account-profile bulk public query port). Cross-module SQL queries and joins remain strictly forbidden.
4. **Durable, Idempotent Notification Pipeline:**
   - Source events write to the source module's outbox in the same database transaction.
   - Outbox relay forwards events to the topic exchange `skillswap.events`.
   - `account-profile` consumes events via queue `account-profile.notification-inbox`, deduplicating via `processed_events`.
   - Creates durable inbox record in `inbox_notifications`.
   - Dispatches remote push to registered active devices via Expo Push Service (targeting APNs for iOS and FCM for Android) with exponential backoff and dead-letter queue.
   - On provider ticket/receipt indicating `DeviceNotRegistered` or invalid token, the token is deactivated immediately (receipt invalidation).
5. **Exact Dashboard Counters:** Learner and teacher dashboard counters are calculated via database aggregation (`COUNT(*)`) at the data owner, never derived by counting items in a paginated list on the client.

**Consequences.**
- (+) Zero architectural regression: 7 schemas and hexagonal module boundaries remain intact.
- (+) Security: Device push tokens are strictly owned by the authenticated account; multi-user devices rebind cleanly on login and unregister on logout.
- (+) Reliability: Outbox + consumer dedup preserves durable inbox entries and avoids duplicate logical dispatch jobs; provider/device delivery remains best effort and must be measured.
- (−) Event payload maintenance: Source events must publish necessary identifiers (`classId`, `startsAt`) so downstream consumers can operate without synchronous calls.

**Verification.**
- Architecture fitness rule `pnpm test:arch` passes with zero dependency violations.
- Hexagonal boundary: Domain and application layers do not import TypeORM, NestJS, or vendor push SDKs.
- Integration tests verify idempotent consumption and outbox emission for all notification-triggering events.

**Supervisor clarification.** The source currently has no account display-name event or class-publication event. Do not assume either exists. Marketplace/detail use an account-profile bulk read facade exposed only through its public API. Schedule queries eligible upcoming classes and confirmed participants through a live-class public query facade, then writes its own deduplicated reminder outbox in its schema. Rating eligibility requires both a confirmed caller-owned booking and an actually Completed class; wall-clock end alone is insufficient. All eight new mobile routes are authenticated at Gateway for this increment. Availability of a provider receipt is not proof of notification receipt on a device.
