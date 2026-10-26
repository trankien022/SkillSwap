# ADR-034: Admin audit log and operations aggregation

- **Status:** Accepted
- **Level:** Software (C4 Level 3 · Component)
- **Date:** 2026-10-15

**Context.** FR-015 requires an Administrator dashboard aggregating the **student-verification
queue**, the **Verifier queue by domain**, **dispute/account-lock lists**, and an **audit log
filterable by actor, time and action type**. Verified against the tree: none of the four reads
exists. The only verification read is `GET /student-verifications/me` (the caller's own row); the
only Verifier queue is expertise-scoped to the caller; there is no dispute or account-lock domain
model; and the only "audit" is `skill_evidence_audit`, scoped to one profile-skill (FR-018).

This decision covers the audit half and the ownership of the aggregation. It is written before
code because it introduces a **new cross-module read path and a new store** — `AGENTS.md` requires
that to be recorded as an ADR first.

**Divergence this ADR resolves.** ADR-028 §4 committed to "a Zod `auditEventSchema` in
`packages/contracts`, matching the SRS `AuditEvent` row" as the reusable artifact FR-015 would
consume. What FR-018 actually shipped under that name is **evidence-scoped**: it is keyed by
`evidenceId`/`version`, its `action` is the closed evidence lifecycle
(`submitted|claimed|approved|rejected|superseded`), and it carries a `snapshot` of evidence
fields. It does not have `target_type`, `target_id`, `old_state_json` or `new_state_json`, so it
cannot describe "an administrator suspended a Verifier" or "a payout destination changed". ADR-028
§4's promise was therefore only partly kept.

**Decision (developer, 2026-10-15).**

1. **Two named shapes, not one widened shape.** The evidence-scoped contract is renamed
   `evidenceAuditEventSchema` (+ `evidenceAuditActionSchema`, `EvidenceAuditEventView`) and keeps
   its FR-018 semantics unchanged. The **general** SRS row becomes `auditEventSchema` in
   `packages/contracts/src/audit-event.ts`, owned by FR-015: `id, actorId, action, targetType,
   targetId, oldState, newState, occurredAt, traceId, metadata, sourceEventId`. Widening the
   evidence shape instead would have forced FR-018's contract to carry nullable admin fields and
   coupled two unrelated lifecycles.

2. **`action` and `targetType` are open sets, validated as dotted identifiers.** A closed enum in
   a shared package would make every newly audited behaviour a contracts release. The wire shape
   constrains the *form* (`student.verification.approved`); which actions exist is the ingest
   layer's business (point 4).

3. **`oldState`/`newState` are shallow scalar maps, whitelisted by construction.** NFR-005 and
   ADR-028 §2 forbid audit rows carrying document contents or personal payloads. The schema cannot
   express nested objects, so a row physically cannot smuggle a document through. The ingest side
   admits fields by name rather than copying a payload wholesale.

4. **FR-015 owns an append-only `admin_audit_event` table in `admin_operation`.** Append-only in
   the same sense as ADR-028 §1: no update or delete path exists in code. The module's role owns
   the schema, so ownership (not a grant) is what would have to change for that to be enforced by
   the database; the migration still issues the `REVOKE` so the intent is recorded at the schema
   level and the guarantee becomes real the moment access is narrowed. Indexes: `(occurred_at, id)`
   for the default sort and `(actor_id, occurred_at)` for the actor filter.

5. **It is populated by consuming domain events, never by joining schemas.** Privileged actions in
   other modules publish through the ADR-013 outbox
   (`student.verification.approved|rejected|revoked`, `skill.evidence.*`,
   `skill.verifier.suspended|revoked`, `wallet.transaction.completed`). The `admin-operation` module
   registers one **idempotent** consumer per event type, keyed `processed_events` by queue name,
   appending exactly one row per event. Broker access stays in `apps/api/src/shared/messaging`
   (AGENTS.md). No cross-schema `SELECT` or foreign key anywhere (ADR-014).

   **Corrected during implementation.** This ADR originally asserted that
   `skill.verifier.suspended|revoked` already flowed through the outbox when FR-004 shipped. It did
   not: `VERIFIER_EVENTS` defined the names but nothing emitted them, so an administrator could
   suspend a Verifier and leave no trace at all. `SqlVerifierRepository.setStatus` now writes the
   status change and its event in one transaction (carrying the previous status, which is the
   old→new pair the audit row needs). The claim in this section was wrong, not merely unverified;
   it is corrected here rather than quietly reworded.

   The mapping table in `audit-actions.ts` names the event types as **literals**, not by importing
   the emitting modules' constants: `module-isolation-*` forbids reaching into another module's
   internals, and that constraint happens to be the right shape — the projection is coupled to the
   published contract and the event stream, not to the modules it observes.

6. **`sourceEventId` makes ingestion idempotent and traceable.** Each row records the event that
   produced it, so a duplicate delivery is a no-op even across a `processed_events` reset, and an
   administrator can trace a row back to the stream without a join.

7. **Aggregation happens in the FR-015 table and its own read ports, not in SQL.** The dashboard
   composes counts by calling each owning module's **published facade reader** (ADR-008/ADR-012
   style) and reading its own summary; it never reaches across schemas. Where a count would require
   another module's rows, that module's port supplies it.

   Concretely, the mechanism is the one `account-profile` already established for
   `PUBLIC_PROFILE_READER`: `student-verification` exposes `VerificationSummaryReader` and
   `skill-verification` exposes `EvidenceSummaryReader` from their `api/` facades, each module
   provides and `exports:` its own implementation, and `admin-operation` imports both modules and
   injects the readers. The schemas stay private; the counts are read live on every request rather
   than cached, so a figure on the dashboard and the queue it points at cannot disagree. `byDomain`
   counts only the two live queue statuses (`pending`, `claimed`), because a domain whose work is
   all decided has no queue to open.

8. **Disputes and account-lock lists are out of scope for this decision.** No domain model, no
   lifecycle and no SRS business rules exist for them beyond FR-015's one-line mention. Inventing
   a model to fill a dashboard table is the failure mode ADR-028 and the task-01 plan forbid.
   FR-015 is recorded as **partially implemented** until a separate spec + ADR covers them.

   **Closed 2026-10-25 by ADR-037**, which supplies that spec: the dispute half is removed from the
   MVP, and the account-lock half is an extension of the existing `active | suspended` status. §8 is
   therefore no longer a gap; the actor-attribution half was closed separately by ADR-035.

9. **Actor attribution is not wired, and the log says so.** Every audited event is mapped with
   `actorId: null`, so the `actor` filter on `GET /audit-log` currently matches only rows written
   without an actor (i.e. every row it can write). This is a **known limitation, not a bug left
   unnoticed** — it was found by exercising the flow, and the decision to ship it this way was
   deliberate.

   The reason is structural. A domain event describes a **fact**, and a fact has no actor:
   `student.verification.approved` is true whoever clicked, and adding an actor to every payload
   would put request-scoped identity into the event contract that ADR-013 defines as the module's
   public vocabulary. The actor is currently available only at the HTTP boundary, where the trusted
   identity arrives as `x-user-id` (`shared/http/identity.ts`). Nothing threads it into the
   use-case command, the repository, or the bus envelope, and no request-context facility
   (`AsyncLocalStorage`) exists in this codebase.

   Closing this properly means choosing a mechanism — an `actorId` on the audited commands carried
   into the payload, or a cross-cutting request context that stamping reads — and that choice
   affects every emitting module (skill-verification, student-verification, wallet-ledger). It is
   therefore its own decision with its own ADR, not a rider on this one. Until it lands, the
   actor column and its filter exist but are inert, and the ADR says so rather than implying the
   feature works.

   > **Superseded by ADR-035 (2026-10-25).** That ADR took the first of the two options — the actor
   > on the command, carried into the payload — and rejected the ambient-context one with a
   > concrete argument: the same emitters also run from sweepers and consumers, where inherited
   > request identity would attribute a system action to a person. System-originated events carry
   > `SYSTEM_ACTOR_ID` rather than `NULL`, so `NULL` keeps exactly one meaning ("before this
   > decision, or unknown") and the no-backfill ruling stays visible. The paragraph above is left
   > as written, because it is what was believed at the time.

**Rationale.** FR-018's immediate, single-schema read stays exactly as it is, so the split costs
nothing at runtime; FR-015 gets the general row ADR-028 always intended. Consuming events keeps
the modules decoupled in the direction ADR-013 established — the audit log is a **downstream
projection**, so a module never learns it is being audited, and a broken audit consumer cannot
break the action it observes. Refusing to model disputes is the honest position: a fabricated
dispute table would be a worse answer than a dashboard that says the section is not ready.

**Consequences.**

- (+) FR-015 gets the SRS `AuditEvent` row it was promised; FR-018 is untouched semantically.
- (+) No cross-schema coupling; append-only satisfies NFR-005; ingestion is idempotent.
- (+) A new audited behaviour is one event subscription, with no change to the wire contract.
- (−) One more table and one more consumer process to operate.
- (−) Audit rows for actions that happen **before** the consumer exists are not backfilled; only
  events published after deployment land. The table is honest about being a projection.
- (−) **`actorId` is always null**, so the log's actor filter matches nothing (see §9). The column,
  the index, and the filter are in place for the change that wires attribution, but until then an
  administrator cannot answer "what did this person do" from the log alone.
- (−) The rename touches FR-018's exported names (`auditEventSchema` → `evidenceAuditEventSchema`),
  a source-level break for any consumer outside this repo. Only `index.spec.ts` used them here.
- (−) The audit log grows unbounded in the MVP (retention kept by the OQ-008/ADR-023 precedent).

**Verification.** Contracts: the general row round-trips, rejects a malformed action, and refuses
a nested `oldState`. Domain: the snapshot admits only whitelisted scalar fields. Repository: the
append path leaves the row unchanged when the same `sourceEventId` is delivered twice, and filters
by actor/time/action — **the actor filter is exercised with an actor supplied directly to the
query, which is what the repository supports; it is not a claim that end-to-end rows carry one**
(§9). Consumer: a duplicate delivery appends one row; an unknown event type is ignored, not fatal.
Architecture tests stay green (`pnpm test:arch`), proving no cross-schema
import was introduced.

**Related:** ADR-013 (outbox + idempotent consumers), ADR-014 (per-module schema, no cross-schema
joins), ADR-008 (gateway), ADR-012 (CQRS reads), ADR-019 (moderation), ADR-023 (verification
retention), ADR-027 (verifier claim/decision), ADR-028 (evidence history + audit contract);
FR-015, FR-018, NFR-005, NFR-014, OQ-008.
