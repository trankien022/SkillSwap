# ADR-023: Student verification and document model

- **Status:** Accepted
- **Level:** Software (C4 Level 3 · Component)
- **Date:** 2026-10-10

**Context.** FR-002 lets a Learner declare a school name and upload a document; an Administrator
then approves or rejects with a reason. It is the source of truth for "verified student" and gates
the rest of the trust group (FR-017 account status, FR-019 re-verification, and later FR-003/FR-005).
Today the `student-verification` module is scaffold-only: no `student_verifications` table, no
submit/decision endpoints, and only the generic `module_status`/outbox tables.

OQ-008 owns four open clauses: (a) verification **validity period**, (b) document **retention** and
deletion, (c) the **expiry cascade / grandfather** rule, and (d) document handling (reference vs
upload). This ADR fixes the **storage/validity** half (a, b, d) and the **one-effective-verification**
rule that SR-BR-011 needs; the **cascade** half (c) is decided with FR-019 in its own Phase 0 and is
explicitly out of scope here.

**Decisions are the developer's, not the agent's (2026-10-10).** OQs are owned by the Product Owner
+ Security; the agent must not resolve them. The developer decided, for the FR-002 scope:

1. **No expiry.** An approved verification does **not** expire in the MVP. `expires_at` is **not**
   modeled. (Detecting expiry and cascading rights is a later FR-019 decision.)
2. **Block.** A new submission is **refused** while an effective (`pending`/`approved`) verification
   exists for the account (SR-BR-011). There is **no** `superseded` state.
3. **Keep.** Verification/submission records are **retained**; there is no deletion workflow in the
   MVP.
4. **Upload with integration.** Documents are **actually uploaded and stored** using **S3 object
   storage with Postgres metadata** (not an opaque reference only).

**Decision.**

1. **Entity.** One table `student_verifications` in the `student_verification` schema, owned by role
   `skillswap_student_verification`, with columns `id (uuid pk)`, `account_id`, `school_name`,
   `major`, `document_ref`, `status`, `reviewer_id`, `reason`, `decided_at`, `created_at`,
   `updated_at`. No cross-schema foreign keys (ADR-014); `account_id`/`reviewer_id` are opaque
   identity ids. **No `expires_at`** (decision 1).

2. **States.** `pending → approved | rejected`. `rejected` **requires a non-empty reason**;
   `approved` may carry the `major` the reviewer confirmed. Transitions are enforced in the domain,
   not just the DB.

3. **Validity period — none (decision 1).** An approval never expires in the MVP; there is no
   `expires_at` and no expiry helper. Expiry/re-verification is FR-019's decision and is not
   pre-empted here.

4. **One effective verification — block (SR-BR-011, decision 2).** "Effective" means status
   `pending` or `approved`. At most one effective row may exist per `account_id`, enforced by a
   **partial unique index** on `(account_id) WHERE status IN ('pending','approved')`. A new
   submission while an effective one exists is **refused** with `DuplicateActiveVerificationError`
   (block, not supersede). The database is the backstop; the use case checks first for a clean error.

5. **Document handling — upload to S3 + Postgres metadata (decision 4).** Submissions carry a real
   uploaded document. The file is stored in **S3** (object storage); Postgres holds the metadata /
   pointer (`document_ref` = the object key). Uploads validate **extension/MIME/size** at the
   boundary, are stored outside executable paths, and their contents are **never logged**
   (NFR-004/008). The storage concern is isolated behind a `DocumentStore` port with an S3 adapter so
   tests use a fake and the bucket/config is injectable. The S3 adapter issues **pre-signed PUT URLs
   (AWS SigV4, `node:crypto`)**, so bytes go client→S3 directly — no new dependency and nothing
   sensitive passes through the API.

   > **Superseded by [ADR-038](ADR-038-cloudinary-document-storage.md):** the provider is now
   > Cloudinary and the target is a **signed multipart POST**, not a pre-signed PUT. The port, the
   > validation rules, the `authenticated` access mode, and the "bytes never traverse the API" property
   > are unchanged; only the adapter and the upload protocol differ.

6. **Retention — keep (decision 3).** A verification row is retained as an audit record (who, when,
   why) — the decision trail AC-001/AC-012 require. A later increment may add pruning; the MVP does
   not delete.

7. **Events (ADR-013).** State changes emit transactional-outbox events
   `student.verification.submitted`, `student.verification.approved`,
   `student.verification.rejected` in the same transaction as the state write. Payloads carry
   `verificationId`, `accountId`, `status`, and — on rejection — `reason`, so FR-017 can project the
   status and reason and FR-016 can notify without a cross-schema read.

**Rationale.** The four decisions were made by the developer, not inferred by an agent. Simplest
model that satisfies AC-001/AC-012: a single small table plus a real S3-backed upload, a partial
unique index making SR-BR-011 a database invariant, and no invented expiry rule (deferred to FR-019).

**Consequences.**

- (+) One effective verification is guaranteed by the schema; submit/decide are race-safe.
- (+) Documents are stored out of the database in S3; metadata stays queryable in Postgres.
- (+) No invented validity rule; expiry is FR-019's decision.
- (+) FR-017/016/019 can be event-fed without cross-schema reads.
- (−) A second submission while one is pending is refused; the Learner must wait or be rejected.
- (−) Introduces S3 configuration/credentials and a storage adapter to operate.
- (−) Historical rows accumulate; a retention/pruning job is a later concern.

**Verification.** Domain: transitions, rejection-reason-required, one-effective rule, no expiry.
Persistence: the partial unique index rejects a second effective row; no `expires_at` column.
Application: submit blocked when an effective verification exists; decision requires the admin role
and emits the matching event. Storage: the S3 adapter validates type/size and never logs contents.
Architecture tests stay green.

**Related:** ADR-013 (outbox), ADR-014 (TypeORM, per-module schema), ADR-016 (identity/roles).

## Amendment A (2026-11-08) — how a reviewer reads a stored document

Decision 5 covers **writing** a document: pre-signed PUT, bytes client→S3, `document_ref` in
Postgres. It says nothing about **reading** one, and that omission had a consequence nobody
intended: an uploaded document could be written and then never opened. An Administrator approved
the gate that unlocks the teacher badge, the marketplace filter and payouts on the Learner's typed
`school_name`/`major` alone, while the evidence for it sat in a bucket unreadable through the
product. This amendment closes that without touching decision 5's write path.

The four questions the original ADR left open are answered below. They were put to the developer as
explicit choices on 2026-11-08 and answered; they are **not** the agent's to infer (see the
2026-10-10 paragraph above).

1. **Read path — pre-signed GET, symmetric with PUT.** `DocumentStore` gains
   `createDownloadTarget(objectKey, expiresInSeconds)`; the S3 adapter signs with the **same** SigV4
   canonicalisation it already uses for PUT, differing only in the method. The URL is minted per
   request from `document_ref`; it is **never persisted, never logged, never listed**, and never
   returned in a collection response. Nothing new is stored, so decision 5 and decision 6
   (retention) are unchanged.

2. **Who may read — `admin` and `verifier`.** Both roles already act on this evidence: the
   Administrator decides the verification, and FR-003's Verifier reviews credentials. Restricting
   the read to `admin` alone would have left a Verifier deciding blind or asking an Administrator to
   relay a file out of band, which is worse in every respect including auditability. The **owner**
   may also read their own submission — they uploaded it — and receives the reference via
   `GET /student-verifications/me`, never a URL from that response. Any other caller gets `403`,
   and a document is resolved only from the verification's own `document_ref`, never from an id
   supplied in the query.

3. **TTL — 300 seconds.** A presigned URL is bearer credential by definition: whoever holds it can
   read the document. Five minutes is long enough to open a multi-page PDF and short enough that a
   URL pasted into a chat is dead before it is useful. 300 s is a **cap**, not a preference — the
   adapter rejects a longer request rather than clamping silently, so no caller can quietly widen
   it. A caller that needs longer mints another URL; minting is cheap and stateless.

4. **Audit — every read, attributed.** Each successful mint emits
   `student_verification.document.read` through the transactional outbox (ADR-013), carrying the
   `verificationId`, the acting `actorId` (ADR-035: actor ≠ subject), and which role read it.
   `admin-operation` consumes it into the append-only `admin_audit_event` store — the same route
   `verification.decision.*` already takes, because ADR-014 forbids `student-verification` writing
   into `admin_operation`'s schema directly. **A refused read is not audited as a read**: an
   unauthorised attempt never mints a URL, so there is nothing to record beyond the auth rejection.

**What this does not decide.** Download expiry does not interact with decision 1 (no verification
expiry) or decision 3 (no deletion workflow): this amendment grants read access to a row that is
retained forever, and says nothing about when either should end. Object-level deletion remains
absent from the MVP; the S3 adapter's `delete` is still a documented no-op seam.

**Consequences.**

- (+) An Administrator or Verifier can open the document they are deciding on, so approval is no
  longer an act of faith in two typed strings.
- (+) Reading is cheaper to audit than writing was: one event, one role, one actor, per mint.
- (−) The URL is a bearer credential for 300 s. A leaked URL is a leaked document for that window;
  the mitigation is the window, not the URL.
- (−) `document_ref` is now load-bearing in both directions, so a bucket/key mismatch surfaces as a
  broken read for a reviewer rather than as an unread file nobody noticed.

**Verification.** Storage: the adapter signs a `GET` and refuses a TTL above 300 s. Application: a
learner reading another learner's document is refused; a refused read mints no URL. Integration: an
uploaded PDF is fetched through a minted URL and the bytes match; an audit row names the reader.
Nothing in the suite writes a URL to a column, a log line or a list response.

**Evidence:** `tasks/evidence/b8-verification-document-download.md`.
