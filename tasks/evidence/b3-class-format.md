# B3 — a class states its format; nobody guesses it again

Date: 2026-11-07
Task: B3 of `../../../2026-11-07-backend-remaining-work.md`

## What was wrong

The API never said whether a class was one-on-one or a group. The web derived it from capacity
(`capacity <= 1 ? 'one-on-one' : 'group-2-4'`) and then rendered the label **"Group class 2-4"**
(`ClassDetail.hero.format.group`) and **"Small group (2 - 4 learners)"** (the filter sidebar) for
every group class — including the seeded 8-, 10- and 12-seat ones. The range was invented by a
client and read as a fact.

## Files changed

Backend

| File | Change |
|---|---|
| `internal/domain/class.ts` | `CLASS_FORMATS`, `ClassFormat`, `classFormatOf(capacity)` — the one rule |
| `application/port/in/class-facts.ts` (new) | `CLASS_LEVELS`/`CLASS_FORMATS` + DTO aliases, extracted from the two ports so the list and the detail page cannot describe the same class differently |
| `application/port/in/{list-classes,get-class-detail}.ts` | `format` on both DTOs; the duplicated level constants now come from `class-facts` |
| `application/port/in/create-class.ts` | `format` on `ClassResource` |
| `application/port/out/{class-list-reader,class-detail-reader}.ts` | `format` on the read records |
| `adapter/out/persistence/sql-class-{list,detail}-reader.ts` | `format: classFormatOf(r.capacity)` — the read path cannot import the domain aggregate (CQRS rule), so the adapters compute it once |
| `application/query/{list-classes,get-class-detail}.query.ts` | thread `format` through |
| `application/{create,update}-class.use-case.ts` | the resource carries `format` too, so a create/PATCH response and a re-read agree |

Contracts

| File | Change |
|---|---|
| `mobile-classes.ts` | `classFormatSchema = z.enum(['one-on-one','group'])`; `classListItemSchema.format` |
| `mobile-class-detail.ts` | `classDetailViewSchema.format` |
| `index.ts` | `classSchema.format` (`ClassResource`) |

Clients — the derivation is deleted, not duplicated:

| File | Change |
|---|---|
| `apps/web/lib/marketplace/api-mapping.ts` | `toClassFormat(capacity)` removed; `format: item.format` |
| `apps/web/lib/marketplace/api-class-detail.ts` | `format: detail.format` |
| `apps/web/lib/marketplace/types.ts` + `mock-data.ts` + `ClassCard` + `FilterSidebar` | `group-2-4` renamed to `group` (mechanical; 9 files) |
| `apps/web/messages/{en,vi}.json` | "Group class 2-4" → "Group class", "Lớp nhóm 2-4" → "Lớp nhóm", "Small group (2 - 4 learners)" → "Group class" |
| `apps/web/lib/marketplace/mock-data.ts` | mock prose "(2-4 learners)" → "small-group session" |
| `apps/mobile` | carries `format` on `ClassView`; no UI change (it renders no format badge) |

Docs: `docs/api/classes.md` regenerated.

## Evidence

**Runtime, through the gateway (stack up, demo data)**

```
GET /classes?limit=20 -> items = 4, 0 missing `format`, 0 disagreeing with capacity
  group       cap=12  React Hooks Deep Dive
  group       cap= 8  IELTS Speaking Part 2: cue cards that sound natural
  group       cap= 6  Everyday English Conversation Practice
  group       cap= 6  Guitar Chords for Absolute Beginners
GET /classes/:id -> format = "group"

POST /classes { capacity: 1 } -> GET back -> format = "one-on-one"
PATCH /classes/:id { "capacity": 4 } -> 200, format = "group", capacity = 4
```

The seed's smallest class is the check the task asked for:

```
seed smallest class -> {"title":"TypeScript Types That Scale","capacity":2,
                        "level":"intermediate","format":"group","state":"full"}
```

**No user-visible 2–4 claim survives**

```
$ git grep -n "group-2-4" -- apps packages      # no output
$ grep -rn "2-4" apps/web/src/messages          # no matches
```

**Gates**

- `pnpm --filter @skillswap/api test` — 1008 passed (new: `classFormatOf(1|4|12|0)`; the created
  resource reports `one-on-one` at capacity 1 and `group` at 6)
- `pnpm --filter @skillswap/contracts test` — 232 passed (new: `format` round-trips, `group-2-4` /
  `small-group` / `GROUP` rejected, absence rejected)
- `pnpm --filter @skillswap/mobile` jest — 261 passed
- `pnpm --filter @skillswap/web` vitest — 51 files, 419 tests passed (new: a 12-seat and a
  2-seat class are both `group`; a capacity-4 class the API calls `one-on-one` stays `one-on-one`)
- full `pnpm verify` — green: lint 0 warnings, build, typecheck, tests, depcruise 1005 modules /
  2905 dependencies with no violation

## Decisions recorded

1. **Where the rule lives.** `domain/class.ts` owns `classFormatOf`, but the query handlers may not
   import `domain/` (`queries-no-domain`, ADR-012), so the persistence readers compute it and the
   records carry the result. One function, one rule, two call sites — not two rules.
2. **`format` is on `ClassResource` as well.** The task named only the list and detail schemas, but
   a create/PATCH response that omitted the format while a re-read supplied it would be the same
   class described two ways. The tests pin that a `PATCH { capacity: 4 }` answers `format: "group"`.
3. **`group-2-4` was renamed, not left as a type member.** The task said the app rename was
   "tracked in the app documents", but the member name is the last place the false range lived and
   the sweep is mechanical (typecheck found every site). `git grep group-2-4` now returns nothing.
4. **`classFormatOf(0)` is `one-on-one`.** Capacity is `>= 1` in the schema and the DB CHECK, so
   this is unreachable; it avoids a `2–4`-style default if the constraint ever slips.
