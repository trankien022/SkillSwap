# Plan — FR-015 Operations Dashboard (API + Web + Mobile)

Status: **Complete (phases 0–6, W1–W4, M2)** — approved to implement; decisions through §9 resolved below
Owner: (agent) · Created: 2026-10-15 · Updated: 2026-10-16 (phases 0–6, W1–W4 and M2 landed; FR-015 remains partially implemented — Phase 7 deferred)

> **Resolved before coding.** Q1 (**No** — admins are web-only): §6 **M1 is closed as not
> applicable** and recorded here rather than silently skipped; M2 ships in the form the device allows (see §6). Q2: audit the
> privileged actions the SRS §5 list names (verification decisions, verifier status changes, role
> changes, financial transitions) — see Phase 4. Q3: retain, no pruning in the MVP (OQ-008 /
> ADR-023 precedent). Q4: keep `total`. Q5: disputes/account-lock stay in deferred Phase 7.
>
> **One correction to Phase 3.** `auditEventSchema` **already existed** in
> `packages/contracts/src/index.ts:610` as FR-018's *evidence-scoped* entry, despite ADR-028 §4
> promising that name for the general SRS row. ADR-034 §1 resolves it by renaming the evidence
> shape to `evidenceAuditEventSchema` and giving the general row the `auditEventSchema` name in
> the new `packages/contracts/src/audit-event.ts`. Phase 0 therefore lands that rename.
>
> **A second correction, found during Phase 3.** ADR-034 §5 claimed
> `skill.verifier.suspended|revoked` already flowed through the outbox. It did not — the names
> existed, nothing emitted them, so an admin suspending a Verifier left no audit trail.
> `SqlVerifierRepository.setStatus` now writes the status and its event in one transaction; the
> mapping table names event types as literals (module isolation forbids importing another
> module's domain constants, which is also the right coupling for a projection). ADR-034 §5 is
> corrected in place.
>
> **Composition mechanism for the dashboard (ADR-034 §7).** The `api/` facade-reader pattern
> `account-profile` already used for `PUBLIC_PROFILE_READER`: `student-verification` exposes
> `VerificationSummaryReader`, `skill-verification` exposes `EvidenceSummaryReader`, and
> `admin-operation` imports both modules and injects their exported readers. Counts are read live
> per request; nothing is cached, so the dashboard and the queue it links to cannot disagree.
>
> **A third correction, found by browser verification.** The audit log is written with
> `actorId: null` for every event, so its actor filter matches nothing. A domain event describes a
> fact and a fact has no actor; the acting user exists only at the HTTP boundary (`x-user-id`) and
> is not threaded into any command, payload or envelope. Wiring it is a cross-cutting choice with
> its own ADR (ADR-034 §9), so per the decision recorded there this change ships the column and
> filter inert rather than inventing attribution. AC-032 and the FR-015 row are qualified to match.

Related: `docs/plans/SkillSwap-SRS.md` (FR-015, UC-014, US-O1, NFR-005, NFR-014),
`ARCHITECTURE.md` §4, ADR-008 (gateway), ADR-012 (CQRS), ADR-013 (outbox), ADR-014 (TypeORM,
per-module schemas), ADR-019 (moderation), ADR-023 (verification retention),
**ADR-028 (audit event contract — binding here)**, ADR-027 (verifier claim/decision),
`docs/plans/LIST-READ-ENDPOINTS.md` (envelope + pagination conventions).

> **Read this first.** ADR-028 §4 is the governing decision for the audit half: the reusable
> artifact is the **`auditEventSchema` contract**, not a shared table. FR-015 owns its own
> aggregation table and reads other modules' events via the broker (ADR-013/ADR-024). This plan
> must not introduce a cross-schema join (ADR-014) and must not invent a store that ADR-028
> already declined to build.

---

## 1. Problem

FR-015 (Must, **Confirmed**) requires:

> The system shall provide an Administrator dashboard aggregating the **student-verification
> queue**, **Verifier queue by domain**, **dispute/account-lock lists**, and an **audit log
> filterable by actor, time and action type**.

Nothing of this exists. Verified against the tree (2026-10-15):

| FR-015 clause | Backing endpoint today | Web | Mobile | Gap |
|---|---|---|---|---|
| Student-verification queue | **none** — only `GET /student-verifications/me` (caller's own row) | id-paste form | n/a | **no list route at all** |
| Verifier queue **by domain** | `GET /verifiers/me/queue` only (caller's *own* expertise) | `/verifier` (own queue) | `/(features)/verifier` (own queue) | no admin-wide view |
| Dispute / account-lock lists | **none** | none | none | **no domain model** |
| Audit log (filter by actor/time/action) | **none** — the only "audit" is `skill_evidence_audit`, scoped to one profile-skill (FR-018) | none | none | **no store, no read** |

There is **no admin dashboard route**. Every route under `apps/web/src/app/[locale]/admin/` is
exactly two: `student-verifications/` and `verifiers/`. Every `Dashboard*` component in the repo
belongs to the **learner** dashboard (FR-021) or the teacher dashboard. `admin-operation` is
module-health scaffolding (`GET /admin-operation/status`), not an aggregation view.

Two of these gaps are already recorded decisions, not oversights:
`2026-10-14-task01-web-verification-plan.md:172,178,187` states there is no pending-verification
list, **forbids inventing one**, and defers it to "backend work later". This plan *is* that
backend work.

## 2. Scope boundaries (what this plan deliberately does NOT do)

1. **Disputes / account-lock are excluded from the first cut.** No domain model exists: no
   `dispute` table, no `account_lock` table, no lifecycle, no SRS business rules for them beyond
   FR-015's one-line mention. Designing them needs its own spec + ADR. **Phase 7 is explicitly
   deferred** and FR-015 is marked *partially implemented* until it lands. Inventing a dispute
   model to fill a table is exactly the failure mode ADR-028 and the task-01 plan forbid.
2. **No new money behaviour.** Audit is read-only here. No ledger changes.
3. **No cross-schema SQL, ever** (ADR-014). Every read is owner-scoped to its module's schema;
   aggregation across modules happens through the FR-015 table fed by events, not joins.
4. **No fabricated admin queue.** If a phase's endpoint is not built, its UI does not ship a
   placeholder list. The existing id-paste admin pages stay until their replacement phase lands.

## 3. Binding decisions

### 3.1 Envelope + pagination (inherit `LIST-READ-ENDPOINTS.md`)
Every new endpoint returns the uniform envelope and is bounded:

```jsonc
// success
{ "success": true, "code": "ADMIN_VERIFICATIONS_OK", "message": "...", "data": { "items": [...], "page": { "limit": 20, "nextCursor": null, "total": 137 } }, "errors": [] }
```
- `limit` 1–100 (default 20), keyset `cursor`, `sort` (`<field>` / `-<field>`, whitelisted),
  `q`, plus per-endpoint filters. Invalid cursor → `400 INVALID_CURSOR`; invalid sort →
  `400 INVALID_SORT`.
- `total` always computed via `COUNT(*)` with the same filters, run in **one transaction**
  alongside the page query (`Promise.all`), per `pagination.ts` + `LIST-READ-ENDPOINTS.md` §3.3.
- Each paged endpoint gets a **supporting index** in an idempotent migration.

### 3.2 Where each piece lives (module ownership)

| Concern | Module | Schema |
|---|---|---|
| Student-verification queue read | `student-verification` | existing `student_verification` |
| Verifier queue by domain (admin-wide) | `skill-verification` | existing `skill_verification` |
| Audit log store + read | `admin-operation` | existing `admin_operation` |
| Aggregation dashboard composition | `admin-operation` (BFF-style query) | reads `admin_operation` only |
| Cross-module audit ingestion | `admin-operation` consumer on `skillswap.events` | ADR-013/028 §4 |

The `admin_operation` module already exists and is the correct owner (§1: it is the operations
module). It has a schema, a data source, a registry entry, and a status controller — the audit
table and the dashboard query go here. **The module is not re-generated**
(`scripts/generate-api-modules.mjs` overwrites scaffolding — never run bare).

### 3.3 Audit model — implement ADR-028, do not redesign it
ADR-028 §4 fixes the contract: a Zod `auditEventSchema` in `packages/contracts` matching the SRS
`AuditEvent` row (`id, actor_id, action, target_type, target_id, old_state_json, new_state_json,
occurred_at, trace_id, metadata_json`). FR-015:

- **owns** an append-only `admin_audit_event` table in `admin_operation`;
- **populates** it by consuming domain events from `skillswap.events` (ADR-013 outbox →
  idempotent consumer, `processed_events` keyed per queue — see `2026-10-12-mobile-main-sync-plan.md:34`);
- **reads** it with filter-by-actor/time/action;
- **never** joins another schema, and **never** reads another module's audit table.

A **new ADR (ADR-034)** is required because this is a structural decision (a new cross-module
read path + a new store), which `AGENTS.md` requires to be recorded before code.

### 3.4 Admin authorization
Every new route is `@Roles('admin')`. Web admin pages gain the same honest "you are not
authorized" surface Phase 2 added (no raw key paths, no silent blank). Mobile is **learner-only**
today (`apps/mobile` has no admin surface and the auth allow-list is
`/^\/student-verifications(?:\/(documents|me))?$/`); see §5 for the mobile decision.

## 4. Phase plan — API

Each phase = **one commit**, `pnpm verify` green at every phase (lint `--max-warnings=0`, build,
typecheck, jest/vitest, `pnpm test:arch`).

### Phase 0 — Docs: requirements trace + ADR-034
Deliverables:
- `docs/plans/SkillSwap-SRS.md`: update FR-015's status cell to record the partial-implementation
  decision (queues + audit log in scope; disputes/account-lock deferred to Phase 7 with a
  pointer). Add AC rows for the dashboard.
- `docs/adr/ADR-034-admin-audit-log-and-operations-aggregation.md`: the aggregation-table +
  event-consumption decision, complying with ADR-028 §4 (state explicitly that it consumes the
  `auditEventSchema` contract and does not couple schemas).
- `docs/api/RESPONSE-CONVENTIONS.md`: add the new endpoints' codes.
Commit: `docs(admin-operation): plan FR-015 audit log and operations aggregation`

### Phase 1 — `GET /student-verifications` (admin queue)
The missing list. Uses the existing `verification-repository.ts`.

Deliverables:
- **Contracts** (`packages/contracts/src/admin-verifications.ts`): `adminVerificationQuerySchema`
  (`limit`, `cursor`, `status`, `schoolName`/`q`, `sort` ∈ `submittedAt|decidedAt|status`) and
  `adminVerificationPageSchema` (paged `StudentVerificationView`). Export from `index.ts`.
- **Port-out**: extend `VerificationRepository` with
  `listForAdmin({ limit, cursor, status, q, sort }): Promise<{ items: Verification[]; total: number; nextCursor: string | null }>`.
- **SQL** (`sql-verification-repository.ts`): bounded keyset query
  `WHERE [status=$..] [AND school_name ILIKE $..] AND (submitted_at, id) > ($cursor) ORDER BY <sort> LIMIT $limit+1`,
  plus same-transaction `COUNT(*)`. Reuse `apps/api/src/shared/http/keyset-cursor.ts`.
- **Port-in** `list-admin-verifications.ts` + `list-admin-verifications.query.ts`
  (`ListAdminVerificationsQueryHandler`) returning `AdminVerificationPage`, mapping via the
  existing `verification-view.ts`.
- **Controller**: add `@Get()` to `student-verification.controller.ts` with `@Roles('admin')`,
  `@Query() AdminVerificationQueryDto`, `@ResponseCode('ADMIN_VERIFICATIONS_OK')`, paged Swagger.
  **Declaration order matters:** Nest matches routes in declaration order, and `@Get('me')` is
  currently the *last* handler in this controller (`:130`). The new bare `@Get()` must be declared
  **after** `me` (or placed so it cannot shadow it), and a controller spec must pin that
  `GET /student-verifications/me` still resolves to `mine`.
- **Migration** (student-verification schema): **the index does not exist yet.** The schema has
  only `ix_student_verifications_account_status` on `("account_id","status")`
  (`1791072000100-CreateStudentVerifications.ts:39`), which cannot serve a status filter ordered
  by `(submitted_at, id)`. Add `student_verifications(status, submitted_at, id)` so the page and
  the count are served from the index.
- **Tests**: repository spec (status filter, `q`, cursor, total, sort, empty), query-handler
  spec, controller spec (admin-only 403, paging shape), cursor round-trip.
Commit: `feat(student-verification): add the admin verification queue read`

### Phase 2 — Admin-wide verifier queue by domain
Extends the existing expertise-scoped queue with an admin scope. Reuses
`list-verifier-queue.query.ts` + `listPendingForExpertise`.

Deliverables:
- **Contracts** (`packages/contracts/src/admin-verifier-queue.ts`): query schema adding `domain`
  (skill id or category) + `expertise` filter and `status` (`pending|claimed`), reusing
  `verifierQueuePageSchema`'s page shape.
- **Port-out**: add `listForAdminQueue({ domain, status, limit, cursor, q, sort })` alongside
  `listPendingForExpertise` (do **not** overload the verifier-scoped method).
- **SQL**: same shape as the existing paginated query but **without** the
  `s.id = ANY(expertise)` restriction, plus optional `domain` (category) / `status` filters.
  Bounded + `COUNT(*)` in one transaction.
- **Port-in** `list-admin-verifier-queue.ts` + handler; **controller**: add
  `@Get('admin/queue')` to `verifier.controller.ts` with `@Roles('admin')`. **Route-order check:**
  Nest matches in declaration order, so `me/queue` must stay declared before any bare
  `:id`-style sibling; pin with a spec.
- **Migration** (skill-verification): **none needed for the base queue.** The supporting index
  `ix_skill_evidence_queue ("status","submitted_at","id")` already exists
  (`1791072000604-AddVerifierQueueIndex.ts:21`). Add a migration **only** if the new `domain`
  (category) filter is not index-served — check `EXPLAIN` before adding, and if added, scope it to
  the category column rather than duplicating the existing queue index.
- **Tests**: repository spec (no-expertise restriction, domain filter, status filter, total),
  handler spec, controller spec (admin-only, paging).
Commit: `feat(skill-verification): add the admin verifier queue view`

### Phase 3 — Audit event contract + store
Implements ADR-028 §4 for FR-015's side.

Deliverables:
- **Contracts** (`packages/contracts/src/audit-event.ts`): `auditEventSchema`,
  `auditActionSchema`, `auditTargetTypeSchema` matching the SRS `AuditEvent` row exactly; export
  from `index.ts`. This is the **reusable** artifact ADR-028 §4 committed to.
- **Domain** (`admin-operation/internal/domain/audit-event.ts` + spec): the append-only record,
  the whitelisted action/target enums, and a `snapshot` policy that **must never** carry document
  contents or anything beyond decision-relevant fields (NFR-005).
- **Port-out** `audit-event-repository.ts`: `append(entry)` (**never** update/delete),
  `list({ actorId, action, targetType, from, to, limit, cursor, sort })`.
- **SQL** `sql-audit-event-repository.ts` + **migration**: `admin_audit_event` (append-only:
  no update path in code; document that the DB role has no UPDATE grant). Columns per ADR-028's
  shape. Indexes: `(occurred_at, id)` (default sort) and `(actor_id, occurred_at)`.
- **Tests**: schema spec (round-trip, rejects unknown action), repository spec (append-only,
  filters, cursor, total), domain spec (snapshot whitelist).
Commit: `feat(admin-operation): add the append-only admin audit log store`

### Phase 4 — Audit ingestion from domain events
Feeds the store without coupling schemas (ADR-013/028 §4).

Deliverables:
- **Outbox publishers already exist** for the behaviours that matter
  (`student.verification.decided/revoked`, `skill.evidence.*`, verifier status changes, class
  lifecycle). Add a publisher only where a privileged action is currently **unaudited** — audit
  the gap first and list the exact events in the phase PR description; do not add events blindly.
- **Consumer** (`admin-operation/internal/adapter/in/messaging/audit-event.consumer.ts`):
  idempotent, `processed_events` scoped **per queue** (the bug fixed in
  `2026-10-12-mobile-main-sync-plan.md:34`), appending exactly one row per event. Broker access
  stays in `apps/api/src/shared/messaging` (AGENTS.md).
- **Tests**: consumer spec (idempotency under duplicate delivery, one row per event, unknown
  event ignored, poison message does not loop), plus an outbox→consumer integration spec.
Commit: `feat(admin-operation): ingest privileged domain events into the audit log`

### Phase 5 — `GET /audit-log` + the dashboard composition
Deliverables:
- **Contracts**: `auditLogQuerySchema` (actor, action, targetType, `from`, `to`, `limit`,
  `cursor`, `sort`, `q`) + `auditLogPageSchema`.
- **Port-in** `list-audit-log.ts` + handler (`@Roles('admin')`).
- **Controller** on `admin-operation`: add a new `audit-log.controller.ts`
  (`@Controller('audit-log')`, `@Get()`), `@ResponseCode('AUDIT_LOG_OK')`, paged Swagger.
- **Dashboard aggregate**: `GET /admin-operation/dashboard` returning the composed summary
  (verification-queue counts by status, verifier-queue counts by domain, audit-log latest N).
  Counts only — no cross-schema SQL; it calls each module's own read port (ADR-008/012 style) or
  reads its own summary. Document the composition source per field.
- **Tests**: query validation (bad sort/cursor → 400), filters by actor/time/action, page shape,
  dashboard composition with a stubbed port per source.
Commit: `feat(admin-operation): expose the audit log and operations dashboard reads`

### Phase 6 — `pnpm docs:api` + SRS traceability close-out
Deliverables: regenerate `docs/api/*`, update FR-015's row to *queues + audit log implemented*, add
the FR-015 → endpoint traceability entries, re-render diagrams only if a component was added.
Commit: `docs(api): regenerate the reference for the FR-015 dashboard endpoints`

### Phase 7 — DEFERRED: disputes / account-lock
**Not part of this plan's commits.** Requires its own spec (domain model, lifecycle, SRS business
rules) and likely its own ADR. Recorded here so FR-015 is honestly marked *partially
implemented*, never "done".

## 5. Phase plan — Web

Each phase pairs with the API phase above; **one commit each**, web tests green.

### Phase W1 — Student-verification queue UI
- `lib/verification/http-gateway.ts`: add `listStudentVerifications(query)` (envelope; typed auth
  error on 401/403 — reuse `AdminAuthError`).
- Replace the id-entry form: build `components/admin/StudentVerificationsQueue.tsx` — filter bar
  (status, school search, sort), keyset "load more", status pills, per-row deep link to the
  existing `[verificationId]` review screen. **The id-paste entry stays available** as a secondary
  "open by id" control during the transition.
- i18n: add the queue strings to **both** `vi.json` and `en.json` (`Admin.StudentVerification.*`),
  keeping parity (the parity test is part of `pnpm verify`).
- Tests: component test (fetches, filters, paging, empty state, 403 → honest banner, failure
  surfaces — reuse the Phase-3 `callApiOk` discipline, never swallow).
Commit: `feat(web): add the admin student-verification queue`

### Phase W2 — Admin verifier queue UI
- Add `listAdminVerifierQueue` to the verification gateway; build
  `components/admin/VerifierQueue.tsx` (domain filter, status filter, paging). Reuse the row
  presentation from `/verifier` where the shape matches.
- Tests: component test (domain/status filters, paging, empty, unauthorized).
Commit: `feat(web): add the admin verifier queue view`

### Phase W3 — Audit log UI
- Add `listAuditLog` to the gateway; build `components/admin/AuditLog.tsx` — filter by actor,
  action, and a date range (`from`/`to`), sortable, paged. Render `old→new` state honestly
  (no raw JSON dump into the UI without a readable summary; no invented fields).
- Tests: filters, date-range boundary, paging, empty, failure surfaced.
Commit: `feat(web): add the admin audit log view`

### Phase W4 — `/admin` dashboard shell
- The route `apps/web/src/app/[locale]/admin/page.tsx` **already exists by then**: the
  post-honesty plan (2026-10-15-post-honesty-flow-fixes-plan.md, P1) adds a landing shell linking
  to the pages that exist. That plan is now **Done** (commit `75def69` for the shell, `eff9536`
  for the role-aware navbar this phase builds on), so both prerequisites are real code, not
  assumptions. This phase **extends that shell** with the composed metrics
  (`components/admin/AdminDashboard.tsx`), turning the deep-link entry point into a real
  landing page while **keeping** the deep links.
- `Navbar` gains an admin-aware entry (mirroring Phase 2's role-aware `navbar.tsx`): the link is
  shown only when the session's role is `admin`. Reuse the Phase 2 signed-in predicate; do not
  reintroduce guest fetches.
- Tests: role gating (admin sees it, learner does not), shell composition with stubs, empty and
  partial-failure states.
Commit: `feat(web): add the admin operations dashboard`

## 6. Phase plan — Mobile

**Decision: mobile gets the read-only audit/queue views only where the role exists on device.**
Rationale: mobile's audience is learners (plus verifiers, already supported). There is no admin
login flow, and the auth allow-list would reject admin paths. Building an admin surface for a
role that cannot sign in would be dead UI.

### Phase M1 — Role-gate + expose the admin reads *if and only if* mobile gets an admin session
- **Precondition (must be answered before coding):** does the product intend admins to use the
  mobile app? If **no** — this phase is **closed as "not applicable"**, and that decision is
  recorded in the phase's commit message / the plan's status, not silently skipped.
- If **yes**:
  - `api-evidence.ts` allow-list: add `/^\/admin-operation\/(dashboard|audit-log)$/` and the
    admin queue paths (this file is the security boundary — extend it deliberately, with a spec).
  - `infrastructure/http/admin-gateway.ts` + spec: `getDashboard`, `listAuditLog`,
    `listStudentVerifications`, `listAdminVerifierQueue` via `requestJson` (envelope-aware).
  - `app/(features)/admin.tsx` + `ui/admin-*.tsx`: role-gated on `user?.role === 'admin'`, with
    an in-screen forbidden banner (mirroring `verifier-queue-view.tsx:224`).
  - `profile-view.tsx`: add the admin link **only** when `user?.role === 'admin'` (mirror line 102).
Commit: `feat(mobile): add the admin operations views`

### Phase M2 — Regression test pinning the mobile role gating
Regardless of M1's outcome: add a spec pinning that the verifier/admin links are absent for
non-privileged roles and present for the privileged one — the same protection Phase 2 gave web.
This closes the "Phase 4" open item from the honesty work.
Commit: `test(mobile): pin role-gated navigation`

**M2 outcome (recorded, not silently skipped).** Half of M2 was already on `main` before this
plan was implemented: `apps/mobile/src/ui/profile-view.spec.tsx` (added in `527261e`) pins that the
Verifier queue link is offered to a verifier and withheld from a learner, an admin and a signed-out
visitor. So the link half needed no new work, and a second copy of it would have been a test that
duplicates an existing one.

The admin half of M2 is **not applicable**, for the same reason §6 M1 was closed: mobile has no
admin navigation surface at all. There is no `admin` route under `apps/mobile/app/`, no
`router.push` to an admin path, and `admin` appears only as a non-interactive role label
(`dashboard-view.tsx` and `profile-view.tsx` render `Dashboard.adminRole` as text) — consistent
with Q1, admins are web-only. There is nothing to gate, so nothing is pinned.

What *was* missing is the other end of the verifier gate: `profile-view.spec.tsx` pins that the
link is only offered, but nothing pinned that the queue **screen** refuses a non-verifier who
reaches it anyway (deep link, stale route, hand-typed URL). `verifier-queue-view.tsx` implements
that refusal — a data-load guard at lines 72–76 and a render guard at lines 224–233 — and it was
implemented but untested. `apps/mobile/src/ui/verifier-queue-view.spec.tsx` now pins it, including
the part that actually matters: the guard returns **before** `gateway.getQueue` is called, so a
leaked link cannot fire a request the server would reject. A refused learner, admin and signed-out
visitor each assert both the forbidden banner and that no request was issued.

## 7. Commit sequence (one line per commit)

```
docs(admin-operation): plan FR-015 audit log and operations aggregation
feat(student-verification): add the admin verification queue read
feat(skill-verification): add the admin verifier queue view
feat(admin-operation): add the append-only admin audit log store
feat(admin-operation): ingest privileged domain events into the audit log
feat(admin-operation): expose the audit log and operations dashboard reads
feat(web): add the admin student-verification queue
feat(web): add the admin verifier queue view
feat(web): add the admin audit log view
feat(web): add the admin operations dashboard
feat(mobile): add the admin operations views        # conditional on §6 precondition
test(mobile): pin role-gated navigation
docs(api): regenerate the reference for the FR-015 dashboard endpoints
```

## 8. Definition of done
- `pnpm verify` green at every phase; no new lint warnings.
- Every new collection read is bounded (`limit` ≤ 100), returns `page`, computes `total` in one
  transaction, and has a supporting index.
- No cross-schema SQL/joins (ADR-014); no float money; the audit table is append-only (NFR-005).
- Contracts added to `packages/contracts` and consumed by **both** web and mobile where the
  surface exists; no hand-rolled wire shapes.
- i18n parity green (`vi.json` / `en.json`).
- `docs/api` regenerated; ADR-034 landed **before** the audit store commit; SRS FR-015 row
  honestly marked *partially implemented* while Phase 7 is deferred.
- No fake admin queue or placeholder list anywhere.

## 9. Open questions (resolve before the phase that needs them)
| # | Question | Blocks | Proposed default |
|---|---|---|---|
| Q1 | Should admins use the mobile app at all? | §6 M1 | **No** → M1 closed N/A, M2 still ships |
| Q2 | Which privileged actions must be audited beyond verification/evidence/verifier-status? | §4 Phase 4 | Audit the SRS §5 list: verification decisions, role changes, financial transitions, payout-destination changes |
| Q3 | Audit retention/pruning in MVP? | Phase 3 | Keep (OQ-008 / ADR-023 precedent); document the growth cost |
| Q4 | `total` cost on the audit log as it grows | Phase 5 | Keep `total` (NFR-014); revisit with a materialised summary only if measured slow |
| Q5 | Dispute/account-lock model | Phase 7 | Out of scope; own spec + ADR |
