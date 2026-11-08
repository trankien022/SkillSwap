# B1 — a class has a title

Date: 2026-11-07
Task: B1 of `../../../2026-11-07-backend-remaining-work.md`

## What was wrong

`live_class.classes` had no `title`, so every client invented one: the web card printed the
*skill* name (two IELTS classes were visually identical), the web detail page put the whole
description inside an `<h1>`, the web bookings list labelled `description` as `classTitle`, the
mobile detail page printed the literal string "Class Details". `q` also only matched
`description`, so a class could not be found by its name.

## Files changed

Backend

| File | Change |
|---|---|
| `migrations/1791072000011-AddClassTitle.ts` (new) | `ADD COLUMN title text`; backfill `left(btrim(description), 120)`; `SET NOT NULL`; `CHECK (length(btrim(title)) BETWEEN 1 AND 120)`; `down()` drops the constraint and the column only |
| `data-source.ts` | migration registered |
| `domain/class.ts` | `MIN/MAX_TITLE_LENGTH`, `InvalidTitleError`, `assertTitle`, `title` on `ClassDraft`/`ClassView`/`PublishedClass`, `title` in `EDITABLE_CLASS_FIELDS` |
| `sql-class-repository.ts` | insert / update / read carry `title` |
| `sql-class-list-reader.ts` | selects `title`; `q` is `(c."title" ILIKE $n OR c."description" ILIKE $n)` |
| `sql-class-detail-reader.ts`, `sql-my-bookings-reader.ts` | select `title` |
| `create-class.use-case.ts`, `update-class.use-case.ts` | pass and validate `title`; the update path re-validates and inherits the AC-017 edit lock |
| `query/{list-classes,get-class-detail,list-my-bookings}.query.ts` | thread `title` into the DTOs |
| `ports/*` + `testing/live-class-fakes.ts` | `title` added to the in/out contracts |
| `classes.controller.ts` | passes `body.title` |
| `shared/http/domain-error.filter.ts` | renders the zod issues a `ZodValidationException` carries instead of discarding them (see "One extra fix") |

Contracts

| File | Change |
|---|---|
| `createClassSchema` | `title: z.string().trim().min(1).max(120)` (required) |
| `updateClassSchema` | `title` optional, same bounds |
| `classSchema`, `classListItemSchema`, `classDetailViewSchema` | `title` required |
| `learnerBookingClassSummarySchema` | `title` required, so the schedule list has it too |

DTOs derive from those schemas, so `classes.dto.ts` / `class-read.dto.ts` needed no edit —
checked rather than assumed.

Clients (required for `pnpm verify` to build, and the defect is a client-visible one)

| File | Change |
|---|---|
| `apps/web` `lib/teacher/http-gateway.ts` | sends `title` as a real field; `description` no longer doubles as the name |
| `apps/web` `lib/marketplace/{api-mapping,api-class-detail,mock-data}.ts`, `lib/booking/*`, `lib/dashboard/api-my-bookings.ts` | `title` mapped through instead of derived from the skill name |
| `apps/web` `components/marketplace/{ClassCard,DetailHeader}.tsx` | card headline and detail `<h1>` render `title`; the description moves to body text |
| `apps/mobile` `app/(features)/teaching.tsx`, `teaching/[id].tsx` | teacher writes and edits a title |
| `apps/mobile` `ui/{marketplace-card,class-detail-view,my-bookings-view}.tsx` | render `title` as the name, `description` as supporting text |
| `apps/mobile` `i18n/{en,vi}.json` | `Teaching.classTitle` |

Data

| File | Change |
|---|---|
| `scripts/seed-demo.mjs` | real `title` on all eight `CLASS_SPECS`, threaded through `insertClass` and its `INSERT` column list |
| `scripts/seed-checkpoint.mjs` | `classes` insert includes `title` |

Docs: `docs/api/classes.md` regenerated with `node scripts/gen-api-docs.cjs`.

## Evidence

All of it is from the running stack (`pnpm db:up`, `pnpm db:migrate`, `pnpm db:demo`,
`api` on 4001, `gateway` on 4000), not from unit tests alone.

**Migration and backfill**

```
$ pnpm db:migrate
  account-profile: up to date
  admin-operation: up to date
  live-class: applied AddClassTitle1791072000011
  ... (7 module schemas)
```

```
$ SELECT count(*) FROM live_class.classes WHERE title IS NULL OR btrim(title) = '';
 missing_titles
----------------
              0
```

The eight seeded classes carry real names, so the backfill never had to invent one:

```
 IELTS Speaking Part 2: cue cards that sound natural
 Everyday English Conversation Practice
 Python for Beginners: Functions and Loops
 React Hooks Deep Dive
 TypeScript Types That Scale
 Japanese Conversation: Ordering Food
 Calculus: Limits and Derivatives Explained
 Guitar Chords for Absolute Beginners
```

**Runtime, through the gateway** (`user1@demo.skillswap.local`, a teacher approved for IELTS and
English Conversation):

```
GET /classes?limit=1     -> 200
  item keys: id,teacherId,teacherDisplayName,skillIds,title,description,...
  title = "IELTS Speaking Part 2: cue cards that sound natural"
GET /classes/:id         -> 200  title = "IELTS Speaking Part 2: cue cards that sound natural"

POST /classes without title      -> 400  message "title: Required"
POST /classes title "   "        -> 400  message "title: String must contain at least 1 character(s)"
POST /classes title of 121 chars -> 400  message "title: String must contain at most 120 character(s)"

POST /classes title "Zebra Protocol" -> 201 (title echoed back)
GET /classes?q=Zebra                 -> 2 matches: "Zebra Protocol II", "Zebra Protocol"
GET /classes?q=Runtime evidence      -> 2 matches (description still matches)

PATCH /classes/:id { title: "Zebra Protocol II" } -> 200, title updated
PATCH /classes/:id { title: "   " }              -> 400, field named
```

The description branch of `q` is deliberately still there: the title is added to search, not
substituted for it.

**Gates**

- `pnpm --filter @skillswap/contracts test` — 229 passed
- `pnpm --filter @skillswap/api test` — 1002 passed
- `pnpm --filter @skillswap/mobile test` — 261 passed
- `pnpm --filter @skillswap/web typecheck`, `pnpm --filter @skillswap/mobile build`,
  `pnpm --filter @skillswap/api build` — clean
- full `pnpm verify` — green: lint (0 warnings), build, typecheck, 415 web + 261 mobile + 1002 api
  + 229 contracts tests, `depcruise` 1003 modules / 2890 dependencies with no violation

## One extra fix, and why it is in this commit

`POST /api/classes` with no title returned `400 {"message":"Validation failed"}`. The task's
"Done when" says the 400 must *name* `title`, and it did not: the global `nestjs-zod` pipe raises
`{ statusCode, message: 'Validation failed', errors: <zod issues> }`, and
`domain-error.filter.ts` only understood the class-validator shape (`message: string[]`), so it
fell through to the generic branch and dropped the issues. Every validation failure in the
product was equally mute, not just this one.

The filter now renders issues as `path: message`, matching what the local
`shared/http/zod-validation.pipe.ts` already produces, so both pipes name a field the same way.
Two tests cover it in `domain-error.filter.spec.ts`. Without this, the first "Done when" box
could only have been ticked by asserting on internal test doubles rather than the wire.
