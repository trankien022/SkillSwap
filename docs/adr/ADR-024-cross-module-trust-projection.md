# ADR-024: Cross-module trust projection

- **Status:** Accepted
- **Level:** Software (C4 Level 3 · Component)
- **Date:** 2026-10-10

**Context.** FR-017 lets a Learner see their **account status** together with their **student
verification status** and, when rejected, the reason. The account status lives in
`account-profile` (FR-001); the verification lives in `student-verification` (FR-002). ADR-014
forbids cross-schema SQL/joins, so one module cannot read the other's tables. A mechanism is
needed for `account-profile` to learn verification status. The same need reappears later:
FR-005 (publish gate) and FR-006 (discovery) must know whether a user is a verified
student/teacher without a cross-schema read.

**Decision (developer, 2026-10-10).** Use an **event-fed local projection**, not a synchronous
port:

1. `account-profile` owns a small projection table `account_verification_status` in its own
   schema (`account_profile`), keyed by `account_id`, with `status`, `reason`, `updated_at`.
2. It consumes the FR-002 events `student.verification.submitted`, `student.verification.approved`
   and `student.verification.rejected` from the shared broker (ADR-013), updating the row
   **idempotently** (the consumer deduplicates on `messageId`; the update is last-writer-wins by
   `occurredAt`).
3. The owner-facing read (`GET /api/auth/me`, extended) joins the account row with this **local**
   projection row — no cross-module call on the read path.
4. Statuses exposed: `pending`, `approved`, `rejected` (+ `reason` on rejection). A user who
   never submitted has **no row** — the API reports the absence (a "not verified" state) rather
   than inventing a row. There is **no `expired` state** (FR-002 decided no expiry).

**Rationale.** The event architecture already exists and every downstream trust consumer needs the
same projection, so a synchronous cross-module call would be re-added per consumer and would couple
reads to another module's uptime. A local projection keeps reads in one schema, is trivially
owner-scoped, and gives FR-005/FR-006 a reusable "is this account verified?" row. Eventual
consistency (a short lag after an admin decision) is acceptable for a status badge.

**Consequences.**

- (+) No cross-schema SQL; reads stay single-schema and fast.
- (+) Reusable by FR-005/FR-006; consistent with ADR-013.
- (−) The status is eventually consistent (updated when the event is consumed).
- (−) A new consumer + table to operate; a missed/failed event needs the standard retry/DLQ path
  (already provided by the consumer).

**Alternatives rejected.** *(Composed read at the edge)* — a synchronous call from `account-profile`
to the verification module's public port on every `me` read: always current, but couples the read
path to another module and would be duplicated in FR-005/FR-006. *(Read the verification schema
directly)* — forbidden by ADR-014 (no cross-schema access).

**Verification.** Unit: the consumer maps each event to the projection row and is idempotent.
Application: the `me` query returns the projected status/reason, owner-scoped, and reports "not
verified" when no row exists. E2E: submit → admin decision → `GET /api/auth/me` reflects the status
and reason. Architecture tests stay green.

**Related:** ADR-013 (outbox + idempotent consumers), ADR-014 (per-module schema), ADR-023 (student
verification model).
