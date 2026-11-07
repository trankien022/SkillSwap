# Plan — backend remaining work (B10, B1–B7)

Date: 2026-11-07
Source of truth for *what* and *why*: [`../../2026-11-07-backend-remaining-work.md`](../../2026-11-07-backend-remaining-work.md)
Base: `origin/main` @ `b69c00f`

## Scope decision

Implement the decision-free tasks only, in the doc's order:

| Phase | Task | Commit |
|---|---|---|
| P0 | B10 — delete the fictitious teacher-initiated completion route from the docs | `docs: …` |
| P1 | B1 — `classes.title` | `feat(live-class): …` |
| P2 | B2 — `classes.level` | `feat(live-class): …` |
| P3 | B3 — `format` from capacity | `feat(live-class): …` |
| P4 | B4 — teacher school + verified on class reads | `feat(live-class): …` |
| P5 | B5 — rating aggregates on class reads | `feat(live-class): …` |
| P6 | B6 — notification read state | `feat(notifications): …` |
| P7 | B7 — inbox copy per device locale | `feat(notifications): …` |

Out of scope, deliberately: **B8** (needs an ADR-023 amendment authored by the team),
**B9** (depends on B8's download port), **B11/B12** (product/scope decisions pending).

## Invariants that every phase must respect

- One database, seven schemas, one role per schema. No cross-schema SQL, no cross-schema FK
  (ADR-014). Another module's facts arrive through its `api/` facade or an event-fed projection.
- Migrations are additive and registered in the module's `data-source.ts`; the existing
  `migrations-registered.spec.ts` guard must stay green.
- Money stays integer; nothing in this plan touches prices.
- `ARCHITECTURE.md` is not edited.
- **Contract additions ripple into both clients' fixtures.** Every new *required* field in
  `@skillswap/contracts` breaks web/mobile test fixtures that build those payloads by hand
  (both apps parse the schemas at the HTTP boundary). Each phase therefore fixes the fixtures
  it breaks — that is part of the phase, not a follow-up, because `pnpm verify` is the gate.
- `pnpm verify` green at the end of every phase. `pnpm docs:api` regenerated in the same
  commit as any route/schema change.

## P0 — B10: stop documenting a completion route that does not exist

Docs only. `classes.controller.ts:179-181` already carries the AC-035 comment; no code changes.

- `docs/plans/SkillSwap-SRS.md:712` — S12 endpoints: drop the `complete` entry, and say what
  actually ends a class.
- `docs/plans/2026-10-12-screen-parity-matrix.md:43` — S12 endpoint list.
- `docs/plans/2026-10-12-screen-parity-matrix.md:97` — this row describes a **past audit**; keep
  the historical quote of what the audit saw, but correct the parenthetical so it does not read
  as a live route list. (The doc's rule: history notes stay.)
- `docs/plans/2026-10-12-screen-parity-matrix.md:129` — route table row.
- `docs/api/FRONTEND-API-GUIDE.md:184, 240-242, 259, 269` — endpoint row, lifecycle prose,
  ASCII diagram, numbered step. Replace with the ADR-021 Amendment A truth: a class completes
  when `starts_at + duration_minutes` passes, or when the room stays empty past the grace
  period; the Teacher cannot end it.
- `docs/api/FRONTEND-API-MAP.md:41` — endpoint row.
- `tasks/plan.md:106` — mobile API matrix row 19.
- `docs/plans/2026-10-24-w8-jitsi-runtime-acceptance-plan.md:85` — step 4 asks the teacher to
  end the class; reword to "wait for the scheduled end / observe the automatic completion".

**Done when**: `grep -rn "id/complete" docs tasks` returns nothing (the sole surviving mention is
the parity matrix's historical note, which names the route inside a correction rather than
advertising it — keep that one); `pnpm docs:api && git diff --exit-code docs/api` is clean after
regeneration in that commit.

## P1 — B1: teacher-authored class title

1. Migration `1791072000011-AddClassTitle.ts` (live_class): add `title text`, backfill
   `left(btrim(description),120)`, `SET NOT NULL`, `CHECK (length(btrim(title)) BETWEEN 1 AND 120)`;
   `down()` drops the column only. Register in `data-source.ts`. Backfill from description, never
   from the skill name (cross-schema).
2. Domain `internal/domain/class.ts`: `title` in `ClassDraft`/`ClassView`/`PublishedClass`, a
   `assertTitle` (1–120 after trim, else `InvalidTitleError`), and `'title'` added to
   `EDITABLE_CLASS_FIELDS` beside `description` so the AC-017 lock covers it.
3. Persistence: `sql-class-repository.ts` insert/update/findById; `sql-class-list-reader.ts`
   selects it and `q` becomes `(title ILIKE $n OR description ILIKE $n)`;
   `sql-class-detail-reader.ts` selects it; `sql-my-bookings-reader.ts` selects it so the
   schedule list can show a name.
4. Ports: `CreateClassRecord`/`ClassEdit`/`PersistedClass`, `ClassListRecord`, `ClassDetailRecord`,
   `LearnerBookingClassRecord`, plus the matching `in/` DTOs (`ClassResource`,
   `ClassListItemDto`, `ClassDetailDto`, `LearnerBookingClassSummaryDto`).
5. Contracts: `createClassSchema.title` (trim 1–120), `updateClassSchema.title?`,
   `classListItemSchema.title`, `classDetailViewSchema.title`,
   `learnerBookingClassSummarySchema.title`.
6. Use cases: `create-class.use-case.ts` and `update-class.use-case.ts` pass `title`.
7. Controller: `classes.controller.ts` forwards `body.title`.
8. Seed: `class_title` for all 8 `CLASS_SPECS`, threaded through `insertClass` (both the
   destructuring signature and the explicit `INSERT` column list).
9. `pnpm docs:api`; fix web/mobile fixtures that construct these payloads.
10. Evidence: `tasks/evidence/b1-class-title.md`.

**Done when** (doc's boxes, plus): migration applies; no NULL/blank titles; `POST /api/classes`
without `title` → 400 naming `title`; list/detail/bookings carry a non-empty title;
`GET /api/classes?q=<word in a title>` finds it; `pnpm verify` 0.

## P2 — B2: the level a class is taught at

1. Migration `1791072000012-AddClassLevel.ts`: `level text CHECK (level IN
   ('beginner','intermediate','advanced','expert'))`, nullable. Backfill **only** classes with
   exactly one skill, from `live_class.teacher_skill_approval.approved_level` for that skill
   (same schema, legal). Multi-skill rows stay `NULL` and render no badge — not guessed.
2. Domain: `ClassLevel` type reusing `skill-level.ts`; `level` on the draft/record, validated.
   **Not** in `EDITABLE_CLASS_FIELDS`.
3. `create-class.use-case.ts`: the publish gate already reads `AccountTrustReader`; persist
   `trust.approvedLevel(skillIds[0])` from that same read. No new gate.
4. `update-class.use-case.ts` cannot set it (not in `ClassEdit`); contract strips/rejects it.
5. Contracts/ports/readers/DTOs: add `level: 'beginner'|'intermediate'|'advanced'|'expert'|null`.
6. Seed: deliberate spread across the four values.
7. Tests: fake trust reader returning `advanced` → persisted record is `advanced`; existing
   publish-gate specs unchanged; `PATCH {"level":"expert"}` rejected or stripped with the stored
   level unchanged.
8. `pnpm docs:api`; evidence `tasks/evidence/b2-class-level.md`.

## P3 — B3: report the format from capacity

1. One helper in `internal/domain/class.ts`: `classFormat(capacity): 'one-on-one' | 'group'`
   (`capacity <= 1` → one-on-one). Used by both read paths so they cannot drift.
2. Contracts: `classFormatSchema` on `classListItemSchema` and `classDetailViewSchema`.
3. Contract test: 1 → `one-on-one`; 4 → `group`; 12 → `group`.
4. No migration, no new column — it is derivable, and a stored copy could go stale against
   `capacity`.
5. Note in the evidence file: the apps' `group-2-4` rename is tracked in the app documents; this
   phase only ships the field.

## P4 — B4: teacher school + verified state

1. Migration `1791072000013-AddTeacherVerifiedSchoolName.ts`: `teacher_verified.school_name text`
   (nullable). Comment states rows populate on the next `student.verification.*` event; **no**
   cross-schema backfill. (`pnpm db:demo` writes it directly, so demo data is complete.)
2. `TeacherTrust` gains `readonly schoolName: string | null`; `UpsertVerifiedTeacherRequest`
   gains `schoolName`. Projector upsert carries it (last-writer-wins by `occurred_at`).
3. `project-teacher-trust.use-case.ts`: pass `event.schoolName` only when
   `status === 'approved'`, else `null` — a revoked verification must not keep advertising a
   school.
4. `SqlTeacherTrustProjector.read` returns `schoolName`.
5. Wire `AccountTrustReader` into `ListClassesQueryHandler` and `GetClassDetailQueryHandler`;
   dedupe teacher ids per page (one read per teacher, never per row); add `verified` +
   `schoolName` to the list item and to `classDetailTeacherSchema`.
6. Contracts: `classListItemSchema.verified/schoolName`, `classDetailTeacherSchema.verified/schoolName`.
7. Seed: `teacher_verified` insert gains `school_name`.
8. Tests: older `occurredAt` does not overwrite a newer school; approved(X) then revoked →
   `verified:false`, `schoolName:null`.
9. `pnpm docs:api`; evidence `tasks/evidence/b4-teacher-school-verified.md`.

## P5 — B5: read ratings back

1. `rating-repository.ts` gains `readAggregate(classIds)` and `readRecent(classId, limit)`.
2. `sql-rating-repository.ts`: `AVG(stars)` rounded to 2 dp + `COUNT(*)`, one batched call for a
   page; `readRecent` uses `ix_ratings_class_created` and resolves learner display names through
   the **account-profile facade** (`PublicProfileReader`), never a cross-schema join.
3. Both queries stop hardcoding `null`/`0`/`[]`. List issues **one** aggregate call per page.
4. Remove the "provisional" doc-comments in the contracts and ports.
5. `ClassListItemDto.averageRating/ratingsCount` lose their literal `null`/`0` types.
6. Tests: `5,4,3 → 4`; `5,4 → 4.5`; no ratings → `null`/`0`; N+1 guard (one aggregate query
   per page); list and detail agree for the same class.
7. Evidence `tasks/evidence/b5-ratings-readback.md`.

## P6 — B6: persist notification read state

1. Port: `markRead(accountId, id)` and `markAllRead(accountId)`; each returns the fresh
   `unreadCount`. Ownership is in the `WHERE`, so someone else's id updates 0 rows → `404`.
2. Adapter: the two `UPDATE … RETURNING` statements plus the existing count query.
3. Contract: `markNotificationsReadResponseSchema` = `{ success: true, unreadCount: int >= 0 }`,
   exported.
4. Controller: `POST notifications/read-all` and `POST notifications/:id/read`, same
   `currentUserId` guard as `@Get()`. Idempotent: marking twice still 200 with the unchanged count.
5. Route-order test mirroring the student-verification one (declared order + path metadata).
6. `pnpm docs:api`; evidence `tasks/evidence/b6-notification-read-state.md`.

## P7 — B7: inbox copy in the reader's language

1. Delete the adapter's private English switch; the only `notificationCopy` is
   `application/notification-copy.ts`.
2. Read time: resolve the account's locale from `notification_devices` (most recently updated
   **active** device, default `vi` — the same default the insert uses) and render `title`/`body`
   from `notificationCopy(type, locale)`; if a type has no copy fall back to `en`, then to the
   stored columns.
3. Write time: still store a value in the NOT NULL `title`/`body` columns — store the `en` copy
   through the same shared function (it is a compatibility fallback only, never rendered when a
   locale copy exists). Columns are not dropped in this task.
4. Tests: a `vi` device reads `Đặt lớp thành công`, an `en` device reads `Booking confirmed`,
   for the same stored row; push and inbox text agree for a single-device account.
5. `pnpm docs:api` if a schema changed (it does not); evidence
   `tasks/evidence/b7-notification-locale.md`.

## Verification protocol per phase

```
pnpm db:migrate          # when the phase adds a migration
pnpm db:demo             # P1, P2, P4 (seed feeds the read paths)
curl …                   # the doc's runtime boxes, with a real token
pnpm verify
```

Runtime probes run against the real gateway (4000) → API (4001) with the seeded demo accounts,
so the "done when" boxes are evidence rather than source-reading.
