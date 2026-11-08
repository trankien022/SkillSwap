# B4 — the teacher's school and verified state reach the class payload

Date: 2026-11-07
Task: B4 of `../../../2026-11-07-backend-remaining-work.md`

## What was wrong

The web had a university dropdown and a "verified only" checkbox, and both were inert: neither
the school nor the verification flag was on the class payload, so the mapper filled the gap with
`schoolName: null`, `schoolCode: null`, `verified: null` and the filters could never match. The
facts existed — `studentVerificationEventSchema.schoolName` carried the school into the event, and
`live_class.teacher_verified` held the flag — but the projection writer dropped the school on the
floor.

## Files changed

Backend

| File | Change |
|---|---|
| `migrations/1791072000013-AddTeacherVerifiedSchool.ts` (new) | `ALTER TABLE "live_class"."teacher_verified" ADD COLUMN "school_name" text` (nullable). **No backfill** — see decision 1 |
| `migrations/data-source.ts` | registers the migration |
| `domain/publish-policy.ts` | `TeacherTrust.schoolName: string \| null` |
| `application/port/out/account-trust.ts` | `UpsertVerifiedTeacherRequest.schoolName` |
| `application/project-teacher-trust.use-case.ts` | `onVerification` passes `event.schoolName` when `approved`, `null` otherwise |
| `adapter/out/persistence/sql-teacher-trust-projector.ts` | reads `school_name`; the upsert carries it under the same `WHERE occurred_at < EXCLUDED.occurred_at` guard |
| `application/port/in/{list-classes,get-class-detail}.ts` | `verified` + `schoolName` on `ClassListItemDto` / `ClassDetailTeacherDto` |
| `application/query/list-classes.query.ts` | injects `AccountTrustReader`, reads **once per distinct teacher**, reads nothing for an empty page |
| `application/query/get-class-detail.query.ts` | reads trust in parallel with the display name |
| `live-class.module.ts` | `ACCOUNT_TRUST_READER` wired into both query handlers |
| `test/support/db.ts` | `seedTeacherTrust` takes `schoolName`; a `verified: false` seed drops it |

Contracts

| File | Change |
|---|---|
| `mobile-classes.ts` | `classListItemSchema.verified: boolean`, `.schoolName: string \| null` |
| `mobile-class-detail.ts` | `classDetailTeacherSchema.verified`, `.schoolName` |

Clients — the fields were already there, they just had no source:

| File | Change |
|---|---|
| `apps/web/lib/marketplace/api-mapping.ts` | `verified: item.verified`, `schoolName: item.schoolName` (`schoolCode` stays `null`, decision 3) |
| `apps/web/lib/marketplace/api-class-detail.ts` | same two from `detail.teacher` |
| `apps/web/lib/marketplace/http-gateway.ts` | `applyClientFilters` honours `verifiedOnly` — the toggle now filters |
| `apps/mobile` | no UI change; the payload now satisfies the stricter contract (fixtures updated) |

Seeds: `scripts/seed-demo.mjs` (`upsertStudentVerification`'s projection `INSERT`) and
`scripts/seed-checkpoint.mjs` both write `school_name`, so `pnpm db:demo` produces real schools
without replaying the outbox.

Docs: `docs/api/classes.md` regenerated.

## Evidence

**Unit tests (both boxes)**

```
apps/api/src/modules/live-class/internal/application/project-teacher-trust.use-case.spec.ts
  ✓ keeps the school while the verification is approved
  ✓ drops the school as soon as the verification is revoked      -> verified:false, schoolName:null
  ✓ does not re-advertise a school from a stale approval that arrives late
  ✓ carries no school for a pending or rejected decision

apps/api/src/modules/live-class/internal/adapter/out/persistence/sql-teacher-trust-projector.spec.ts
  ✓ reads the school from the same local projection row as the flag
  ✓ reports no school when the row predates the column
  ✓ reports unverified and no school when the account has no projection row
  ✓ writes the school and keeps last-writer-wins on occurred_at
```

The "older `occurredAt` does not overwrite a newer school" case is a property of the SQL guard,
not of TypeScript, so it is proved twice: the in-memory table in the use-case spec models the
guard, and the projector spec asserts the guard is actually in the statement
(`"occurred_at" < EXCLUDED."occurred_at"`). The real statement was then run against Postgres:

```
BEGIN;
1 after approved T1        | t | School A (T1) | 2026-11-01 10:00:00+00
2 after stale T0           | t | School A (T1) | 2026-11-01 10:00:00+00   <- INSERT 0 0, ignored
3 after revoke T2          | f |               | 2026-11-02 10:00:00+00   <- school cleared
4 after newer approve T3   | t | School A (T3) | 2026-11-03 10:00:00+00
ROLLBACK;
```

**Runtime, through the gateway (stack up, `pnpm db:demo`)**

```
GET /api/classes?limit=5 -> 4 items, 0 missing a boolean `verified`,
                            0 without a string-or-null `schoolName`, 4 with a real school
  Demo User 3  verified=true  Demo University 3  React Hooks Deep Dive                cap=12
  Demo User 1  verified=true  Demo University 1  IELTS Speaking Part 2: ...           cap= 8
  Demo User 1  verified=true  Demo University 1  Everyday English Conversation ...    cap= 6
  Demo User 5  verified=true  Demo University 2  Guitar Chords for Absolute Beginners cap= 6

GET /api/classes/:id -> teacher { "displayName":"Demo User 3", "verified":true,
                                  "schoolName":"Demo University 3", ... }
```

**A revocation clears the school on the read path, end to end**

`POST /api/student-verifications/:id/revocation` (admin) → 200 `status: "revoked"`; the
`student.verification.revoked` event flowed through the outbox into the projection:

```
converged after 1 poll(s)
{"title":"React Hooks Deep Dive","verified":false,"schoolName":null}

live_class.teacher_verified ->
  dbdb18ed-… | f | (null) | 2026-11-07 12:09:14.913+00
```

`pnpm db:demo` was re-run afterwards, so the demo database is back to its 8 seeded classes with
their schools.

**Gates**

- `pnpm --filter @skillswap/api test` — 1020 passed (was 1008; +12: the two new specs and the
  handler assertions)
- `pnpm --filter @skillswap/contracts test` — 234 passed (was 232)
- `pnpm --filter @skillswap/mobile` jest — 261 passed
- `pnpm --filter @skillswap/web` vitest — 51 files, 420 tests passed (was 419)
- `pnpm verify` — green: lint 0 warnings, build, typecheck, all suites, depcruise 1008 modules /
  2917 dependencies with no violation

## Decisions recorded

1. **No backfill.** The source of truth is
   `student_verification.student_verifications.school_name`, which is a different schema, and
   ADR-014 forbids the join. The migration comment says so explicitly: existing rows read as "no
   school" until their next `student.verification.*` event. The demo seed writes the projection
   directly (as it always did) so a fresh `pnpm db:demo` still shows schools.
2. **The school is a fact of the approval, not of the account.** A `pending`/`rejected`/`revoked`
   event writes `schoolName: null`. Keeping it would leave a revoked account advertising an
   affiliation it no longer has, which is exactly the claim the badge is supposed to mean.
3. **`schoolCode` stays `null` on the web.** The wire carries a free-text school name; the app's
   `UniversityCode` union (`bk`, `ftu`, `ueh`, `uit`, `kien-truc`, `ussh`) is a client-side
   vocabulary with no server counterpart. Mapping a name onto one of six codes would be a guess,
   and it is the same class of invention the old mapper was fixed to stop making. Consequence:
   the **verified-only** toggle now filters for real and the school renders on the card and the
   detail page, while the *university* dropdown still cannot match API data. Fixing that needs a
   server-side school vocabulary (a product decision), not a client lookup table.
4. **One projection read per distinct teacher, not per row.** A page of 20 classes from one
   teacher is one fact. `ListClassesQueryHandler` builds the distinct id set once and fans out
   with `Promise.all`; an empty page issues no reads at all.
5. **A failed trust read fails the page.** The alternative — silently degrading to
   `verified: false` — would render "not verified" for a teacher who is, which is a worse lie than
   an error. The reader sits on the same database as the readers already in the call path.
