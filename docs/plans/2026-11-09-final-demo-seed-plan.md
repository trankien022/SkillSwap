---
title: Final-demo dataset — every module, every flow, with real history
type: plan
date: 2026-11-09
topic: final-demo-seed
status: Draft
owner: Group 4
---

# Final-demo dataset — every module, every flow, with real history

**FRs:** FR-001…FR-013, FR-015…FR-020 (FR-014 deferred) · **BRs:** BR-001/004 (verification gate), BR-033 (no lost credit), BR-042/043 (completion)
**Modules:** `scripts/seed-demo.mjs` (owner) + read paths in all seven schemas
**Relates to:** ADR-007 (per-schema roles), ADR-013 (outbox), ADR-022 (refund display), ADR-026 (skill taxonomy), ADR-034/035/037 (audit + locks), ADR-039 (JaaS)

---

## 0. Why now, and what is actually missing

The deployed demo must survive an examiner clicking **every** screen. The current seed
(`scripts/seed-demo.mjs`) populates the *happy path of the data model* but leaves the
**read surfaces that make the product look finished** empty:

| Screen / flow | Row source | Today | Visible symptom |
|---|---|---|---|
| Class detail, class list (`ratingsCount`, `recentRatings`) | `live_class.ratings` | **0 rows** | every class shows "no ratings"; teacher has no score |
| `/bookings/[id]/review` (FR-013) | `ratings` | 0 | rating flow cannot be demonstrated |
| Live classroom chat (FR-012) | `chat_messages` | 0 | chat panel is empty |
| Join evidence / no-show (FR-011, AC-035) | `class_presence` | 0 | `mark-teacher-no-show` has nothing to read |
| "class starting soon" (FR-016) | `class_reminders` | 0 | reminder path never fires |
| Admin audit log + dashboard recent events (FR-015) | `admin_operation.admin_audit_event` | **0 rows** | `/admin/audit-log` blank; dashboard shows none |
| Notifications, unread badge (FR-016) | `account_profile.inbox_notifications` | **0 rows** | `/notifications` empty, badge `0` |
| Admin opens a document (FR-002/ADR-023 Amdt A) | `student_verifications.document_ref` → Cloudinary | fake key | signed URL 404s |
| Account-lock list (ADR-037) | `accounts.status='suspended'` | 0 | `/operations` lock list empty |
| Evidence decision history (FR-018) | `skill_evidence` versions | 1 each | no rejected→approved history |
| Wallet history (FR-009/010) | `ledger_entries` | `top_up`, `teacher_credit`*, `refund` | no payment/income rows |
| Top-up outcomes (FR-008) | `top_up_intents` | 1 settled | no pending/failed/reversed |

`*` `teacher_credit` is **not** a production entry type — production writes `teacher_pending`,
`platform_fee`, `release`. The seed invented one.

### Two defects the rewrite must fix, not paper over

1. **The reset is destructive and unscoped.** `seed-demo.mjs:421-425` calls `resetDemo()`
   unconditionally (`--reset` is cosmetic), and **23 of its 26** `DELETE` statements carry
   **no `WHERE`** — only `inbox_notifications`, `notification_devices` and `accounts` are scoped
   to `%@demo.skillswap.local`. Run against Neon — which `db:demo` does, because both scripts read the
   repo-root `.env` — it wipes *every* class, booking, wallet and ledger row in the database,
   whoever owns it. Today that is harmless only because the database holds nothing but e2e
   residue.
2. **Balances are asserted, not derived.** Every wallet is hand-set to `500 + i*250` while the
   ledger holds one matching `top_up` row and no `learner_debit` for any of the confirmed
   bookings. `sql-wallet-reader.sums()` reads those same rows, so the balance and the history it
   is supposed to summarise disagree. Fix: build the ledger first, then compute each balance from
   it.

A third, quieter one: every row is written with `created_at = now()`, so "history" is one
timestamp duplicated N times and every list is ordered by `id`. History must be **backdated**.

## 1. Decisions

1. **One script, rewritten in place.** `seed-demo.mjs` stays the only demo seed.
   `db:demo` keeps its name. A second script would be a second thing to drift.
2. **Deterministic UUIDs.** Every demo-owned row that has a UUID id gets a fixed id whose first
   four hex characters are `5eed` (`5eedacc0-0000-4000-8000-0000000000NN` for accounts,
   `5eedc1a5-…` for classes, `5eedb00c-…` for bookings, and so on). Cleanup then targets
   `id::text LIKE '5eed%'` per table instead of assuming the table is disposable — and re-runs
   converge instead of accumulating.
   Tables keyed by text or by a natural key are cleaned by *demo account id* or by a
   `demo-seed-` reference prefix (see §3).
3. **Ledger first, balance second.** The script declares movements; the wallet row is computed
   from them (`available = credits − debits`, `pending = teacher_pending − release − refunded
   teacher share`). A `--check` assertion fails the run if a balance does not reconcile.
   This is the difference between a demo that *shows* money and one that *balances*.
4. **Backdated timeline.** One anchor `T0 = now`, everything else expressed as offsets, so the
   dataset reads as a real three-week history and looks the same whenever it is run.
5. **Target is explicit and guarded.** The script prints the database host and refuses to run
   against a non-local host unless `--allow-remote` is passed. Neon is a real deployment; a
   typo should not be able to wipe it.
6. **No outbox seeding.** Seeding `outbox_messages` would make the publisher *replay* the demo's
   history on boot — duplicate notifications, and settlement events the ledger already applied.
   Projections (`inbox_notifications`, `admin_audit_event`, `verified_students`,
   `teacher_verified`, `teacher_skill_approval`) are written **directly**, exactly as the existing
   seed already does for the last three. This keeps the seed a pure data load.
7. **`ratings`/`chat`/`presence` obey their gates.** A rating exists only for a `confirmed`
   booking on a `completed` class; chat only for that booking's participants; presence only for
   the class's participants. Seeding rows that the read paths would refuse to produce is how a
   demo breaks under a click.
8. **Admin email is configurable, password stays `Demo1234!`.** Demo emails live on
   `@demo.skillswap.local`; the admin address defaults to `quan.tri@demo.skillswap.local`
   (not `admin@`), overridable with `DEMO_ADMIN_EMAIL`.

## 2. What "all the flows" means — the scripted scenario

The dataset is a small, coherent story, not a spreadsheet. Timeline relative to `T0`:

| When | What | Rows |
|---|---|---|
| D−28 | Accounts registered | 11 accounts + credentials |
| D−26 | Student verifications decided | approved ×7, rejected ×1 (reason), pending ×2, revoked ×1 |
| D−22 | Skill evidence submitted/decided | approved ×6 teachers, 1 rejected→resubmitted→approved (v1/v2), superseded ×1 |
| D−21…D−2 | **Four completed classes** | each: 2–3 confirmed bookings, settlement ledger, chat, presence, ratings |
| D−14 | **Cancelled class** (teacher cancelled) | confirmed booking → `cancelled`, refund ledger, cancellation notification |
| D−9 | **No-show incident** | presence shows learner only; `room_access_incidents` row |
| D−3 | Top-up history | settled ×2, pending ×1, failed ×1, reversed ×1 |
| T0 | **One class in progress** | presence open, chat live, joinable now |
| T0+1d…+30d | **Published classes** | 5 published, 1 full, 1 draft (teacher-only) |
| T0+2h | **Class starting soon** | `class_reminders(starting_soon)` already claimed |
| anywhere | Inbox + audit | notifications for every account; audit for every decision above |

Class states modelled: `draft`, `published`, `full`, `in_progress`, `completed`, `cancelled` —
all six, which is every value the CHECK allows. Booking states: `pending`, `confirmed`,
`completed`, `cancelled` — all four. (Completed classes keep bookings `confirmed`: the rating
gate and `ratingEligible` both read `confirmed` + a completed class. This is already documented
at `seed-demo.mjs:574-576` and stays.)

## 3. Phases

Each phase is one commit, independently runnable.

### Phase 1 — Safety foundation (no new data)

- `scripts/seed-demo.mjs`
  - `resolveDemoAccounts()` → the 11 emails, resolved to ids; throw if a partial set exists.
  - `resetDemo(ctx)` rewritten: per-table, `WHERE`-scoped to `id::text LIKE '5eed%'` (UUID tables)
    or to the demo account ids / `demo-seed-` reference prefix (text-keyed tables), in FK order:
    `ratings → chat_messages → class_presence → class_reminders → room_access_incidents →
    bookings → classes → teacher_skill_approval → teacher_verified →
    verification_documents → student_verifications →
    ledger_entries → top_up_intents → wallets →
    skill_evidence_audit → profile_skills → verifier_expertise → verifiers →
    verified_students → inbox_notifications → notification_devices →
    account_verification_status → sessions → accounts →
    admin_audit_event (by `source_event_id LIKE 'demo-seed-%')`.
    (`push_deliveries` cascades from `inbox_notifications`; `skill_evidence` cascades from
    `profile_skills`; `class_reminders`/`class_skills` cascade from `classes`.)
  - Target guard: print `DATABASE_HOST`; refuse non-local without `--allow-remote`.
  - `--check` (read-only): report target, row counts per table, and any demo balance that does
    not reconcile. Safe to run against Neon.
- `scripts/db-demo.mjs`: skip `docker compose up` + `waitForPostgres` when the configured host is
  not `localhost`/`127.0.0.1`, and pass extra args through to the seed.
- `package.json`: add `"db:seed-demo": "pnpm build && node scripts/seed-demo.mjs"`.

**Done when:** on Neon, `node scripts/seed-demo.mjs --allow-remote` deletes only `5eed…` rows and
the e2e residue survives; a second consecutive run leaves identical counts.

### Phase 2 — Money: ledger-first, backdated, reconciled

- Ledger helpers replaced by one `postMovement({ownerId, entryType, direction, amountCredits,
  referenceId, teacherId, bookingId, releaseKey, occurredAt})`.
- Entry types written exactly as production does (`sql-wallet-repository.ts`):
  `top_up` (credit), `reversal` (debit), `learner_debit` (debit), `teacher_pending` (credit),
  `platform_fee` (credit, owner `platform`), `release` (credit + `release_key`), `refund` (credit).
- 90/10 split enforced from the class price (`Math.floor(price*0.9)` teacher, remainder fee),
  never typed by hand.
- `deriveWallet(ownerId)` sums the rows this script wrote and **asserts** `available >= 0`,
  then upserts `wallets`. No hand-assigned balances remain.
- `top_up_intents` in all four statuses; `paid_amount_vnd`, `paid_at`, `provider_order_id` set
  for settled; a `reversed` intent paired with its `reversal` ledger row.
- `--check` gains a full reconciliation: per demo wallet, `available = Σcredits − Σdebits`,
  `pending = Σteacher_pending − Σrelease − Σrefunded teacher share`.

**Done when:** `/wallet` for a learner shows top-up, two booking debits and a refund in
date order; for a teacher shows pending income and a release; `--check` reconciles every wallet.

### Phase 3 — Class history: ratings, chat, presence, reminders, incidents

- `insertClass` gains `createdAt`/`completedAt`/`completionBasis`/`cancelledAt`/`reason`.
- Four completed classes at D−21/−16/−9/−4, each with 2–3 confirmed bookings, settlement and
  release ledger rows, and 2–4 `chat_messages` between teacher and learners (`sender_role`
  `learner`/`teacher`, body ≤ 1000, ids `5eedc4a7-…`).
- `ratings` for ~80% of completed confirmed bookings (`stars` 1–5, comment 1–1000 chars);
  deliberately leave one un-rated so the "rate this class" flow is demonstrable, and one 3★ with
  a critical comment so the average is not a flat 5.
- `class_presence`: closed sessions (`joined_at`, `left_at`) for past classes; for the
  `in_progress` class an **open** teacher session and open learner sessions (respects the
  `(class_id, account_id) WHERE left_at IS NULL` unique index). `class_id` is text here and
  carries the bare class id, matching `classIdFromRoom`'s last-segment parse.
- `class_reminders`: `starting_soon` for the class at T0+2h.
- `room_access_incidents`: one row for the D−9 no-show (`booking_id`, `class_id`,
  `requester_id`, `reason`, `trace_id`).

**Done when:** class cards show a real `ratingsCount`; class detail shows `recentRatings`;
the in-progress class's chat panel has history; `/my-bookings` shows one rateable past class and
one already-rated.

### Phase 4 — Trust history: versions, revocation, suspension, documents

- Evidence **version history**: for one `profile_skill`, v1 `rejected` (reason) → v2 `approved`;
  for another, v1 `superseded`; audit rows for every transition (`submitted`, `claimed`,
  `approved`/`rejected`, `superseded`) with `from_status`/`to_status`/`snapshot`.
  Respects `ux_skill_evidence_approved_per_skill` (one approved per profile skill).
- One student verification `revoked` with reason + `revoked_at`, cascaded to
  `account_verification_status`, `verified_students`, `teacher_verified`.
- One `suspended` user (satisfying the accounts CHECK: reason + `suspended_at`) and one
  `suspended` verifier — both with `account.status.changed` / `skill.verifier.suspended` audit
  rows, so `/operations` and `/admin/verifiers` have something to show.
- `verification_documents` matching each `document_ref`.
- **Document open (FR-002) limitation:** `read-verification-document` signs a Cloudinary URL from
  `document_ref`; a fake key yields a 404. Phase 4 therefore adds an **optional**
  `--upload-documents` that generates a 1-page PDF and uploads it if `CLOUDINARY_*` is configured;
  without credentials the seed prints a warning and document-open is documented as non-demoable.
  This is stated rather than hidden.

**Done when:** `/verification` shows status + reason; the verifier queue shows pending and
claimed counts by domain; `/admin/verifiers` shows one suspended.

### Phase 5 — Operations surfaces: inbox + audit

- `inbox_notifications` per demo account across all six types
  (`verification_outcome`, `booking_confirmed`, `booking_cancelled`, `class_starting_soon`,
  `wallet_transaction`, `withdrawal_outcome`) and all four `target_type` values, backdated,
  mixed read/unread (≥1 unread per account so the badge is non-zero), `deduplication_key`
  prefixed `demo-seed-`.
- `admin_audit_event` for every decision in §2 using the **exact** action strings from
  `audit-actions.ts` (`student.verification.approved`…, `skill.evidence.claimed/approved/rejected`,
  `skill.verifier.suspended`, `wallet.transaction.completed`, `account.status.changed`),
  `actor_id` = who acted (ADR-035), `target_type`/`target_id` per the mapping, `old_state` →
  `new_state` jsonb, backdated `occurred_at`, `source_event_id` `demo-seed-…` (unique index).
  Note: the module role owns the table, so the `REVOKE` in the migration does not block this.
- **No `outbox_messages`, no `push_deliveries`** (§1 decision 6). Devices are seeded
  `is_active=false` so a later real notification does not push to a fake token.

**Done when:** `/notifications` renders grouped history with a non-zero badge; `/admin/audit-log`
filters by actor/action/time; the dashboard's `recentAuditEvents` is non-empty.

### Phase 6 — Verification, docs, live run

- Seed ends with a **report**: per-table row counts, per-account balance reconciliation, and the
  login sheet (email → role → what it demonstrates).
- `docs/runbooks/demo-dataset.md`: what is seeded, what each account demonstrates, the exact
  commands for Neon vs local, and the two known limits (document open without Cloudinary; FR-014
  withdrawal is deferred and its page shows "unavailable").
- `AGENTS.md`: add `db:seed-demo` to the command table (docs-only change).
- Run against Neon with `--allow-remote`; capture the report.

**Done when:** the report reconciles, the runbook exists, and a spot-check of `/`, `/classes`,
`/classes/[id]`, `/wallet`, `/my-bookings`, `/notifications`, `/admin/audit-log`,
`/operations`, `/verifier`, `/instructor` returns data for the right account.

## 4. Guardrails (what the seed must never do)

- No `DELETE`/`TRUNCATE` without a `WHERE` scoped to `5eed%` or a demo account id.
- No float money; every amount integer VND/credits; split computed, not typed.
- No cross-schema joins; each write goes through its own module's data source (ADR-007/014).
- No `outbox_messages` rows; no `DEAD` markers.
- No balance that contradicts its own ledger.
- No rating without a confirmed booking on a completed class; no chat for a non-participant.
- No row whose timestamp is `now()` except the intentional "live now" fixtures.

## 5. Risks

| Risk | Mitigation |
|---|---|
| A scoped delete misses a table, leaving orphans | `--check` counts every demo table; FK order documented in Phase 1 |
| Balance drift on re-run | balances recomputed from the ledger each run; `--check` asserts |
| Seeding Neon by accident | host printed; remote refused without `--allow-remote` |
| Demo admin reachable publicly | documented trade-off; email configurable; password unchanged by request |
| Cloudinary absent → broken document link | optional `--upload-documents`; limitation documented |
| Boot-time sweeper mutates fixtures (completes past classes, sends reminders) | past classes seeded already-terminal with `completed_at`; reminders pre-claimed |
