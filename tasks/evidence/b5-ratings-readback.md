# B5 — rating aggregates are read back into the class queries

Date: 2026-11-07
Task: B5 of `../../../2026-11-07-backend-remaining-work.md`

## What was wrong

Race FR-013 has had a write path since the beginning: a learner posts one rating per eligible
booking and it lands in `live_class.ratings`. Nothing ever read it back. Both class queries emitted
constants:

```ts
averageRating: null, // provisional until T16
ratingsCount: 0,     // provisional until T16
recentRatings: [],   // provisional until T16
```

So the write was invisible. A learner could rate a class and the page still said "no ratings yet";
`minRating` could never match a real class, and `sort: 'rating'` sorted a permanently `null` field.

## What changed

| File | Change |
|---|---|
| `application/port/out/rating-repository.ts` | new `RatingAggregate { average, count }`, `RatingRecentView { id, learnerDisplayName, stars, comment, createdAt }`, and two methods: `readAggregate(classIds)` → `ReadonlyMap`, `readRecent(classId, limit)` |
| `adapter/out/persistence/sql-rating-repository.ts` | `readAggregate`: one `GROUP BY "class_id"` statement for the whole page (`SUM(stars)::bigint` + `COUNT(*)`); `readRecent`: `WHERE class_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2` (served by `ix_ratings_class_created`); learner names resolved through `PublicProfileReader`. Exported `averageFrom(total, count)` for the rounding rule |
| `application/query/list-classes.query.ts` | `readAggregate(records.map(r => r.id))` **once** per page, in the existing `Promise.all` next to the trust reads; each item takes its own class's entry |
| `application/query/get-class-detail.query.ts` | reads the aggregate for the class and up to 5 newest reviews, in the same `Promise.all` as the teacher name |
| `application/port/in/list-classes.ts` | `averageRating: null` → `number \| null`, `ratingsCount: 0` → `number` (the literal types were the lie) |
| `application/port/in/get-class-detail.ts` | documents that the pair on `teacher` is the class's aggregate, and what `recentRatings` holds |
| `live-class.module.ts` | `PUBLIC_PROFILE_READER` into the `RATING_REPOSITORY` factory; `RATING_REPOSITORY` into both query handlers |
| `packages/contracts/src/mobile-classes.ts`, `mobile-class-detail.ts` | "provisional rating fields (rating table not yet implemented)" → the real sources (schemas unchanged — the fields always had the right shape) |
| `scripts/seed-demo.mjs` | see defect 1 below |

No migration: `ratings` and its index already existed (`1791072000006-CreateClassRatings`).

## Defect found while proving it

**The demo could not produce a single rating.** The seed wrote `state = 'completed'` for bookings of
the completed class, but no code path ever moves a booking to `completed` — `completeElapsedClass`
leaves bookings `confirmed`, and both the rating gate and `ratingEligible` read
`confirmed` + completed class. The first runtime attempt was refused with *"Only the learner of a
confirmed booking may rate a completed class"*, and `GET /classes/bookings/me` reported
`ratingEligible: false` for a booking it had just called `completed`. Fixed in the seed (bookings of
the completed class stay `confirmed`), which also makes the learner dashboard's "pending review"
counter real. The API was right; the fixture was lying.

```
before seed fix:  confirmed|completed 0   completed|completed 3
after  seed fix:  confirmed|completed 3   completed|completed 0
GET /classes/bookings/me -> ratingEligible: true, hasRated: false
```

## Evidence — runtime, through the gateway

Three learners each own a `confirmed` booking on the same completed class
(`b36471a1-…`, "Calculus: Limits and Derivatives Explained").

```
[0 ratings]  teacher.averageRating = null, ratingsCount = 0, recentRatings = []
             -> a class nobody rated has no mean; 0 stars would be a verdict nobody gave

POST /classes/bookings/<id>/rating {stars:5}  -> 201 RATING_SUBMIT_OK
POST ...                            {stars:4}  -> 201
[5,4]        averageRating = 4.5, ratingsCount = 2
             recentRatings = [4 stars (Demo User 8), 5 stars (Demo User 7)]   <- newest first

POST ...                            {stars:3}  -> 201
[5,4,3]      averageRating = 4,   ratingsCount = 3
             recentRatings = [3 (User 10), 4 (User 8), 5 (User 7)]

POST duplicate {stars:1}            -> 409 HTTP_409   (FR-013: exactly one rating per booking)
```

Learner names arrive as display names (`Demo User 7/8/10`) resolved through the account-profile
facade — the `ratings` statement contains no reference to `account_profile`.

**The two read paths agree**

```
GET /classes?teacherId=me  -> same class: averageRating=4, ratingsCount=3
GET /classes?limit=50      -> unrated class "React Hooks Deep Dive": averageRating=null, ratingsCount=0
```

**Unit tests**

```
apps/api/.../sql-rating-repository.spec.ts
  readAggregate (B5)
    ✓ turns an exact integer sum into a mean rounded to 2 decimals   (12/3 -> 4, 9/2 -> 4.5, 13/3 -> 4.33, 0/0 -> null)
    ✓ asks the database once for the whole page and keys the result by class id
    ✓ deduplicates ids and skips the database for an empty page
  readRecent (B5)
    ✓ reads newest first and resolves learner names through the account-profile facade
    ✓ falls back to a neutral name when a learner profile is missing or blank
    ✓ skips the profile lookup when the class has no ratings

apps/api/.../query/list-classes.query.spec.ts
    ✓ reads the aggregate once for the whole page and puts each class its own value (B5)
      -> readAggregate called 1x with ['cls-1','cls-2','cls-3'] (N+1 guard)
      -> 4/3, 4.5/2, null/0

apps/api/.../query/get-class-detail.query.spec.ts
    ✓ reports a class with no ratings as null/0 and no reviews — never 0 stars
    ✓ reports the aggregate and the newest reviews that learners actually wrote
```

## Decisions recorded

1. **The average is exact integer arithmetic, not `AVG()`.** `AVG(smallint)` is a `numeric` that the
   pg driver hands back as a *string*; re-parsing it is where a `4.5` becomes `4.499999`. The
   statement returns `SUM(stars)::bigint` and `COUNT(*)`, and `averageFrom(total, count)` divides and
   rounds once. Same number, and the rounding rule is a pure function with its own test.
2. **Two decimals.** Matches what the clients already render (`4.5`, `4.33`) and what the contract
   allows (`z.number().min(0).max(5)`).
3. **No ratings is `null`, never `0`.** `0` is a rating; a class nobody rated has no mean. The
   contract already allowed `null`, which is why the field survived as a literal for so long.
4. **The aggregate is per class, and the contract nests it under `teacher`.** Field names are
   frozen (additive rule), so `ClassDetailTeacherDto.averageRating` keeps its name; the value is the
   aggregate of *this class's* ratings. That is the only reading under which the list row and the
   detail page can agree for the same class, which is what the task's "done when" asks. A true
   per-teacher cross-class average would be a different field and a product decision.
5. **One aggregate query per page.** `readAggregate` takes the ids; the adapter issues one grouped
   statement. Classes with no ratings return no row and are absent from the map, so the page does
   not need a second query to distinguish "unrated" from "zero".
6. **Learner names come through `PublicProfileReader`.** `ratings.learner_id` points into
   `account_profile`, another schema, and ADR-014 forbids the join — so the ids travel to the
   facade and the names come back. A missing or blank profile renders `SkillSwap learner`: the
   contract requires a non-empty name, and this is the same neutral fallback the class list already
   uses for a teacher, claiming nothing about the person.
7. **Five recent reviews.** The detail page shows the newest few, not a paginated wall; five is what
   the layout already mocked and it is a constant in the query handler, not a wire parameter.
8. **A failed rating read fails the page.** Same reasoning as B4's trust read: silently degrading to
   "no ratings" would render "unrated" for a class that is rated, and the reader is on the same
   database as the readers already in the call path.

## Gates

- `pnpm verify` — green: lint (`--max-warnings=0`), build, typecheck, all suites, depcruise
  1008 modules / 2923 dependencies, 0 violations
- `@skillswap/api` — 156 suites, 1028 tests (was 1020; +8 from the new repository and query cases)
- `@skillswap/contracts` — 10 suites, 234 tests
- `@skillswap/mobile` — 35 suites, 261 tests
- `@skillswap/web` — 51 files, 420 tests
- `docs/api/classes.md` regenerated
