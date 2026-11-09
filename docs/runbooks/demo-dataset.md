---
title: Demo dataset — what the seed writes and how to demo it
type: runbook
date: 2026-11-09
topic: final-demo-seed
status: Active
owner: Group 4
---

# Demo dataset

`scripts/seed-demo.mjs` builds the dataset the final demo runs on. Everything below is what it
writes, which account shows which screen, and the limits that are real rather than hidden.

The dataset is a **scoped** load: it replaces its own rows and nothing else. Demo accounts live on
`@demo.skillswap.local`, every demo UUID begins `5eed`, and every demo natural key
(`reference_id`, `source_event_id`, `deduplication_key`, `installation_id`, `provider_ref`)
begins `demo-seed-`. A run against a database that also holds real or e2e data leaves those alone.

## Commands

```bash
pnpm build                                  # the seed imports apps/api/dist
node scripts/seed-demo.mjs --check          # read-only: target host + demo-owned/total counts
node scripts/seed-demo.mjs                  # seed a local database
node scripts/seed-demo.mjs --allow-remote   # seed the database in the repo-root .env (Neon)
node scripts/seed-demo.mjs --allow-remote --upload-documents
```

`--upload-documents` stores a real one-page PDF under each verification's `document_ref` in
Cloudinary, so the Administrator's "open document" action resolves instead of 404ing. It needs real
`CLOUDINARY_*` credentials; without them the seed warns and continues.

`pnpm db:demo` still works: it starts Docker, migrates, then seeds. It skips the Docker step when
the configured host is not local, which is what makes it usable against Neon.

The seed is **idempotent**. Two consecutive runs produce identical demo counts — the closing report
prints them as `demo-owned / total`, so the comparison is a glance rather than a query.

## Accounts

Password for every account: `Demo1234!`. The Administrator address defaults to
`quan.tri@demo.skillswap.local` (override with `DEMO_ADMIN_EMAIL`) rather than `admin@…`, because
the demo is public and the password is published.

| Email | Role | What it demonstrates |
|---|---|---|
| `quan.tri@demo.skillswap.local` | admin | Operations: verification queue, verifier queue, account locks, audit log |
| `verifier1@demo…` | verifier | Two pending claims it owns (Japanese, IELTS) |
| `verifier2@demo…` | verifier | Two claims already taken (React, Python) |
| `verifier3@demo…` | verifier | The Guitar/Piano reviewer behind the rejected→approved history |
| `verifier4@demo…` | verifier | **Suspended** — stood down, with no decisions attributed to it |
| `verifier5@demo…` | verifier | **Revoked** — the terminal state on the verifier screen |
| `user1@demo…` | user | Teacher: IELTS + English approved, Japanese still queued |
| `user2@demo…` | user | Teacher: React claim taken by a verifier; Python + TypeScript approved |
| `user3@demo…` | user | Teacher: React + TypeScript approved, Python claimed |
| `user4@demo…` | user | Teacher: Japanese approved, IELTS pending |
| `user5@demo…` | user | Teacher: Piano **refused, then approved on resubmission** (two versions) |
| `user6@demo…` | user | Teacher: Calculus approved then **superseded** by a higher level |
| `user7@demo…` | user | Student verification **pending** — a queue item to decide |
| `user8@demo…` | user | Student verification **rejected**, with its reason; also holds the one **unrated completed booking**, so it is the account that shows "rate this class" |
| `user9@demo…` | user | Student verification **revoked** after approval |
| `user10@demo…` | user | **Suspended** account — on the lock list; login refused |

## What is seeded

- **Accounts (16)**: 1 admin, 5 verifiers, 10 users, each with credentials and a student
  verification in one of `approved` / `pending` / `rejected` / `revoked`.
- **Skills (10)** and **profile skills (14)**. The `skills` catalogue is shared and is *not*
  deleted by the seed.
- **Skill evidence (16 rows)**: approved levels for six teachers, a live verifier queue of four
  (two pending, two claimed), and two profile skills carrying real version history.
  Every approval is attributed to a verifier who owns that skill in `verifier_expertise`, and
  every queue claimant is an `approved` student — the same gates the API applies.
- **Classes (13)** covering all six states — `draft`, `published`, `full`, `in_progress`,
  `completed`, `cancelled` — on a backdated timeline. **Bookings (38)** across `pending`,
  `confirmed` and `cancelled`.
- **Ledger (104 entries) and wallets (10)**, derived rather than asserted: confirmed bookings post
  `learner_debit`, `teacher_pending` and `platform_fee` on a computed 90/10 split; completed classes
  post `release`; the cancelled class posts `learner_debit` then `refund`. Wallet balances are
  recomputed from those rows and the run **fails** if they disagree. `top_up_intents` covers
  `settled`, `pending`, `failed` and `reversed`.
- **Ratings (11)** on three completed classes, chosen so the newest finished class keeps one
  unrated booking (the "rate this class" flow — that booking belongs to `user8`) and the averages
  are not a flat 5.0.
- **Chat (5)**, **presence (19)**, **reminders (1)**, **room-access incidents (2)**.
- **Inbox (29)**, **devices (5)**, **push deliveries (13)** across five of the six notification
  types, mixed read/unread, with failed attempts among the deliveries.
- **Audit (12)**: one row per audited action in `audit-actions.ts`, with the target types and
  old→new shape that consumer writes.

## Limits that are real

1. **Document open needs Cloudinary.** Without `--upload-documents` and real credentials, the
   signed URL is well-formed but the object does not exist, so the Administrator's document link
   404s. This is the only screen that depends on a paid-tier decision.
2. **`withdrawal_outcome` is not seeded.** FR-014 (teacher withdrawal) is deferred in the SRS and
   the type has no producer in this release. Seeding one would demo a notification the product
   cannot send.
3. **Push devices are inactive.** Their tokens are demo strings, not Expo tokens; an active row
   would make the worker attempt a delivery that must fail. The delivery history is fixture data.
4. **`admin_audit_event` is append-only in fact.** The migration revokes `UPDATE` and `DELETE` from
   the module's role, and PostgreSQL honours that against the table owner. The seed inserts with
   `ON CONFLICT (source_event_id) DO NOTHING`, so re-runs never rewrite a past decision — and a
   stale audit row from an earlier dataset revision will persist until the role's grant changes.
5. **`withdrawal_outcome`'s FR is deferred**, as is the payout rail; `/wallet` shows top-ups and
   settlement, not payouts.

## Verifying a run

```bash
node scripts/seed-demo.mjs --check
```

prints the target database (`local` / `remote`), then `demo-owned / total` for every seeded table.
Run it twice after a seed: the demo column must not move. `--check` writes nothing.
