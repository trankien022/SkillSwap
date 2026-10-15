# ADR-028: Evidence decision history and the audit event contract

- **Status:** Accepted
- **Level:** Software (C4 Level 3 · Component)
- **Date:** 2026-10-11

**Context.** FR-018 requires a Teacher to see the **complete decision history for every immutable
evidence version** (BR-014: old/new decisions, reviewer, time, level, reason retained when a
version is superseded). FR-003 stores each submission as a `skill_evidence` **version** and FR-004
records `reviewer_id`/`decided_at`, but there is **no history read and no audit record** yet — the
current row only holds the *latest* state, so the old→new trail AC-016 requires is lost. FR-015
(Admin audit log) will also need a reusable audit shape; the SRS data dictionary already names an
`AuditEvent` (`id, actor_id, action, target_type/id, old_state_json, new_state_json, occurred_at,
trace_id, metadata_json`).

**Decision (developer, 2026-10-11).**

1. **Append-only per-module audit table (Option A).** `skill_verification` gains a
   `skill_evidence_audit` table, **append-only**, written in the **same transaction** as the state
   change it records (ADR-013 pattern). Columns: `id, evidence_id, profile_skill_id, version,
   action, actor_id, from_status, to_status, reason, snapshot (jsonb), occurred_at, trace_id`.
   It is never updated or deleted (NFR-005).

2. **Actions recorded.** `submitted` (FR-003), `claimed` (FR-004), `approved`/`rejected` (FR-004),
   and `superseded` (FR-004 approval of a replacement — recorded against the **superseded** version
   so its trail shows why it stopped being effective). The `snapshot` is a **whitelisted** copy of
   the decision-relevant fields (requested/approved level, status, reason, reviewer) — **never
   document contents** (NFR-005).

3. **Immutable evidence content.** Evidence content (`document_ref`, `description`, `evidence_type`,
   `version`, `requested_level`, `submitted_at`) is **never updated** after submission; only
   lifecycle fields (`status`, `claimed_by/at`, `reviewer_id`, `approved_level`, `reason`,
   `decided_at`) change, and each such change appends an audit row. A correction is a **new
   version**, not an edit (BR-014).

4. **Reusable contract, not a shared store.** The **audit event shape** (Zod `auditEventSchema` in
   `packages/contracts`, matching the SRS `AuditEvent` row) is the reusable contract FR-015 will
   consume. FR-018 does **not** build a cross-module audit store: FR-015 keeps its own aggregation
   table (per its plan) and reads this module's events (ADR-013/ADR-024). This avoids coupling
   modules through a shared table (ADR-014).

5. **History read.** `GET /api/skill-evidence/:id/history` returns every version of the
   profile-skill and its ordered audit entries (newest version first), readable by the **evidence
   owner**, the **reviewing Verifier**, or an **Administrator** (FR-018; UC-002).

6. **Retention — keep (OQ-008 pointer).** History/audit rows are **retained; no deletion in the
   MVP** — the same "keep" decision the developer already made for verification records (OQ-008,
   ADR-023). No new OQ; FR-018 records the pointer.

**Rationale.** A transactional append-only table gives FR-018 an immediate, single-schema read that
survives every later state change (the whole point of "history"), and is the honest mechanism for
BR-014's old→new trail. Sharing the **contract** (not a table) keeps FR-015 free to aggregate on its
own terms without a cross-module join.

**Consequences.**

- (+) Full per-version history, immutability enforced, single-schema read for FR-018.
- (+) A reusable `auditEventSchema` for FR-015; consistent with the SRS `AuditEvent` row.
- (+) No cross-schema coupling; append-only satisfies NFR-005.
- (−) One more table and an audit write on every lifecycle change.
- (−) History grows unbounded in the MVP (retained by decision; pruning is a later concern).

**Verification.** Domain: history entries order by version/`occurred_at`; a decision never mutates
evidence content. Application: submit/claim/decide/supersede each append exactly one audit row in
the same transaction. E2E: submit v1 → reject → submit v2 → approve → history shows both versions,
their decisions and the supersession. Architecture tests stay green.

**Related:** ADR-013 (outbox), ADR-014 (per-module schema), ADR-023 (verification & retention),
ADR-026 (taxonomy/levels), ADR-027 (verifier claim/decision); BR-014, FR-018, NFR-005, OQ-008.

**Addendum (2026-10-15, ADR-034).** Point 4 above promised a single reusable `auditEventSchema`
matching the SRS `AuditEvent` row. What shipped here is the **evidence-scoped** entry: keyed by
`evidenceId`/`version`, with the closed evidence lifecycle as its `action`, and a `snapshot` of
evidence fields. ADR-034 §1 records that divergence and resolves it by naming the two shapes
apart — this one is now `evidenceAuditEventSchema`, and the general SRS row is
`auditEventSchema` in `packages/contracts/src/audit-event.ts`, owned by FR-015 (ADR-034). Nothing
in this decision's semantics changed; only the export names did.
