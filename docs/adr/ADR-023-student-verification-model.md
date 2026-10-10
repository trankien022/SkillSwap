# ADR-023: Student verification and document model

- **Status:** Accepted
- **Level:** Software (C4 Level 3 · Component)
- **Date:** 2026-10-10

**Context.** FR-002 lets a Learner declare a school name and a document reference; an Administrator
then approves or rejects with a reason. It is the source of truth for "verified student" and gates
the rest of the trust group (FR-017 account status, FR-019 re-verification, and later FR-003/FR-005).
Today the `student-verification` module is scaffold-only: no `student_verifications` table, no
submit/decision endpoints, and only the generic `module_status`/outbox tables.

OQ-008 owns four open clauses: (a) verification **validity period**, (b) document **retention** and
deletion, (c) the **expiry cascade / grandfather** rule, and (d) it is referenced by SR-BR-001 and
SR-BR-011. This ADR fixes the **storage/validity** half (a, b) and the **one-effective-verification**
rule that SR-BR-011 needs; the **cascade** half (c) is decided with FR-019 in its own Phase 0 and is
explicitly out of scope here.

**Decision.**

1. **Entity.** One table `student_verifications` in the `student_verification` schema, owned by role
   `skillswap_student_verification`, with columns `id (uuid pk)`, `account_id`, `school_name`,
   `major`, `document_ref`, `status`, `reviewer_id`, `reason`, `decided_at`, `expires_at`,
   `created_at`, `updated_at`. No cross-schema foreign keys (ADR-014); `account_id`/`reviewer_id`
   are opaque identity ids.

2. **States.** `pending → approved | rejected`, plus `superseded` for a submission displaced by a
   newer one (see §4). `rejected` **requires a non-empty reason**; `approved` may carry the
   `major` the reviewer confirmed. Transitions are enforced in the domain, not just the DB.

3. **Validity period.** An approval is time-boxed: `expires_at = decided_at + 365 days`, a **fixed
   MVP default** (one academic year). `expires_at` is set only on `approved`; `pending`/`rejected`/
   `superseded` rows leave it null. The value is a single domain constant so it can move to
   configuration later. Expiry does **not** mutate the row here: detecting `now >= expires_at` and
   cascading rights is FR-019's job; FR-002 only records the deadline.

4. **One effective verification (SR-BR-011).** "Effective" means status `pending` or `approved`.
   At most one effective row may exist per `account_id`, enforced by a **partial unique index** on
   `(account_id) WHERE status IN ('pending','approved')`. A new submission while an effective one
   exists is **rejected** with `DuplicateActiveVerificationError` (block, not supersede); a Learner
   resubmits only after the prior row is `rejected` or `superseded`. The database is the backstop;
   the use case checks first for a clean error.

5. **Document handling (NFR-008/NFR-004).** `document_ref` is an **opaque reference**, not a path,
   URL, or base64 payload; it is all the backend stores. Contents never enter the database, are
   never logged, and are served only inside the owning account's flow — satisfying NFR-004 without
   a document table. Actual upload/storage is out of the MVP backend scope (a storage port is
   stubbed for later); validation of extension/MIME/size happens at the upload boundary when it is
   built.

6. **Retention.** A verification row is retained while it is the account's current or historical
   verification, i.e. **indefinitely in the MVP** as an audit record (who, when, why) — the
   decision trail that AC-001/AC-012 require. Because the contents are not stored (§5), the audit
   row holds no sensitive document; only the opaque ref remains. Deleting the referenced document
   itself is a storage concern owned by a later increment and does not break this row.

7. **Events (ADR-013).** State changes emit transactional-outbox events
   `student.verification.submitted`, `student.verification.approved`,
   `student.verification.rejected` in the same transaction as the state write. Payloads carry
   `verificationId`, `accountId`, `status`, and — on rejection — `reason`, so FR-017 can project the
   status and reason and FR-016 can notify without a cross-schema read.

**Rationale.** A single small table plus an opaque document reference is the minimum that satisfies
AC-001/AC-012 while keeping NFR-004 trivially true (nothing sensitive to leak). A partial unique
index makes SR-BR-011 a database invariant rather than a race-prone application check. Fixing one
365-day default resolves the "does approval expire" ambiguity for FR-002 without pre-empting
FR-019's cascade policy, which stays a separate decision. Blocking (not superseding) a second
submission makes the state machine simple and the Learner's next step explicit.

**Consequences.**

- (+) One effective verification is guaranteed by the schema; submit/decide are race-safe.
- (+) No document content stored or logged; retention/audit needs no sensitive store.
- (+) FR-017/016/019 can be event-fed without cross-schema reads.
- (−) A second submission while one is pending is refused; the Learner must wait or be rejected.
- (−) The 365-day period is a code constant until configuration exists; cascade on expiry is
  deferred to FR-019 (ADR to name there).
- (−) Historical rows accumulate; a retention/pruning job is a later concern.

**Verification.** Domain: transitions, rejection-reason-required, one-effective rule. Persistence:
the partial unique index rejects a second effective row. Application: submit blocked when an
effective verification exists; decision requires the admin role and emits the matching event.
Architecture tests stay green.

**Related:** ADR-013 (outbox), ADR-014 (TypeORM, per-module schema), ADR-016 (identity/roles).
