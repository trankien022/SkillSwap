# B2 — a class records the level it is taught at

Date: 2026-11-07
Task: B2 of `../../../2026-11-07-backend-remaining-work.md`

## What was wrong

No class had a level. Every client guessed one from the *skill catalogue* — the web read
`skill.levels[0]` (the lowest level the skill supports, not the level this class is taught at)
and rendered it with a `: 'C2'` fallback, so a wrong badge was not even visible as wrong. A
teacher approved at `advanced` for React and `beginner` for TypeScript had no way to say which
level a particular class ran at.

## Files changed

Backend

| File | Change |
|---|---|
| `migrations/1791072000012-AddClassLevel.ts` (new) | `ADD COLUMN level text`; backfill from `teacher_skill_approval.approved_level` for single-skill rows only; `ck_classes_level` CHECK; `down()` drops both |
| `data-source.ts` | migration registered |
| `domain/class.ts` | `ClassLevel` alias of the approval scale, `isClassLevel`, `InvalidClassLevelError` |
| `application/create-class.use-case.ts` | reads `trust.approvedLevel(skillIds[0])` from the projection the gate already fetched and persists it; no new gate, no second read |
| `application/update-class.use-case.ts` | returns the stored level; never sets it |
| `ports/out/class-repository.ts` | `level` on `PersistedClass` and `CreateClassRecord`; deliberately **absent** from `ClassEdit` |
| `ports/in/{create-class,list-classes,get-class-detail}.ts` | `level` on the resource and both read DTOs |
| `sql-class-repository.ts`, `sql-class-list-reader.ts`, `sql-class-detail-reader.ts` | select / insert `level`, parsed through `isClassLevel` so a bad row degrades to `null` |
| `query/{list-classes,get-class-detail}.query.ts` | thread `level` through |

Contracts

| File | Change |
|---|---|
| `classSchema` | `level: skillLevelSchema.nullable()` (the create/update resource) |
| `classListItemSchema` | same |
| `classDetailViewSchema` | same |
| `updateClassSchema` | unchanged — `level` is **not** accepted (see below) |

Clients — the level now comes from the class instead of the catalogue:

| File | Change |
|---|---|
| `apps/web` `lib/marketplace/api-mapping.ts` | `item.level ?? toSkillLevel(skill)` — the catalogue is only the fallback for a `null` row |
| `apps/web` `lib/marketplace/api-class-detail.ts` | same rule for the detail page |
| `apps/web` `lib/booking/http-gateway.ts`, `demo-class.ts` | carry `level` onto the panel's `ClassView` |
| `apps/mobile` `mock/demo-class.ts` + spec fixtures | `level` added |

`apps/mobile` needed no UI change: it does not render a level badge, and adding one is an app task.

Data: `scripts/seed-demo.mjs` gives each `CLASS_SPEC` an explicit `level` that matches the
teacher's approval for that skill, and `insertClass` writes the column. `seed-checkpoint.mjs`
writes `'advanced'` for the teacher it creates an approval for.

Docs: `docs/api/classes.md` regenerated.

## Evidence

**Migration and backfill** (running stack)

```
$ pnpm db:migrate
  live-class: applied AddClassLevel1791072000012

$ SELECT count(*), count(level), count(*) - count(level) FROM live_class.classes;
 total | with_level | null_level
-------+------------+------------
     8 |          8 |          0

$ SELECT c.title, c.level, a.approved_level FROM classes c LEFT JOIN teacher_skill_approval a ...
 Calculus: Limits and Derivatives Explained          | expert       | expert
 Japanese Conversation: Ordering Food                | intermediate | intermediate
 TypeScript Types That Scale                         | intermediate | intermediate
 Python for Beginners: Functions and Loops           | advanced     | advanced
 React Hooks Deep Dive                               | expert       | expert
 IELTS Speaking Part 2: cue cards that sound natural | intermediate | intermediate
 Everyday English Conversation Practice              | advanced     | advanced
 Guitar Chords for Absolute Beginners                | advanced     | advanced
```

Every row agreed with the approval, so the backfill never had to invent one. The migration only
touches classes with **exactly one** skill; a multi-skill class keeps `NULL`, because the
projection is keyed `(account_id, skill_id)` and nothing records which skill a mixed class is
pitched at. `pnpm db:demo` produces the same spread from the seed.

**Runtime, through the gateway**

```
GET /classes?limit=20 -> items = 4, none missing `level`
  expert       React Hooks Deep Dive
  intermediate IELTS Speaking Part 2: cue cards that sound natural
  advanced     Everyday English Conversation Practice
  advanced     Guitar Chords for Absolute Beginners
GET /classes/:id -> level = "expert"

POST /classes { capacity: 1, ... } -> 201
  {"state":"published","title":"Level Probe One On One","level":"intermediate", ...}
GET /classes/:id -> level = "intermediate"

PATCH /classes/:id { "level": "expert" }        -> 400 "At least one field is required"
GET /classes/:id                                -> level = "intermediate"   (unchanged)
PATCH /classes/:id { "level":"expert", "capacity": 4 }
                                                -> 200, capacity 4, level "intermediate"
```

The level is immutable two ways: `updateClassSchema` does not declare it, so zod strips it (a
body of only `level` becomes an empty edit and is refused), and `ClassEdit` has no such field,
so even a hand-built command cannot reach the SQL.

**Gates**

- `pnpm --filter @skillswap/contracts test` — 231 passed (new: `level` round-trip, `null`
  accepted, `'master'` rejected, `updateClassSchema` strips `level`)
- `pnpm --filter @skillswap/api test` — 1006 passed (new: persisted record is the fake's
  `advanced`; the level comes from `skillIds[0]` when a class has two skills)
- `pnpm --filter @skillswap/mobile test` — 261 passed
- `pnpm --filter @skillswap/web` vitest — 51 files, 417 tests passed
- typecheck/build clean in contracts, api, web, mobile
- full `pnpm verify` — green: lint (0 warnings), build, typecheck, tests, `depcruise` 1004
  modules / 2901 dependencies with no violation

## Decisions recorded

1. **Which skill's level wins.** `skillIds[0]`. The gate already required *every* skill approved,
   so the first is a floor the caller can reason about, and the class still shows one badge. A
   test pins it so a later refactor cannot silently change the badge.
2. **Why the seed's levels are not `LEVELS[(user+s) % 3]` again.** That array is
   `['intermediate','advanced','expert']` — no `beginner` — and the class row must agree with the
   approval row, not with the position in the list. The seeded values are copied from the
   approval each teacher actually received.
3. **`null` stays legal on the column** even though every newly published class has a level,
   because legacy multi-skill rows have no honest value.
