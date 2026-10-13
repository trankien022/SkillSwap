# Phase 1E — S13 rating honesty + D4 publish-surface unification

Scope: the two remaining Web↔Mobile parity defects that touch money-adjacent or
trust-adjacent behaviour. Both were recorded in
`2026-10-12-screen-parity-matrix.md`.

> Revised after review. Corrections applied: `HttpTeacherPublishGateway` does
> **not** exist (net-new code); `lib/teacher/mock-data.ts` cannot be deleted (it
> holds the money helpers used by `PricingRevenueCard`); the `PublishForm.test.tsx`
> and `/instructor` create-class modal were missing from scope; the fabricated-data
> inventory was incomplete; and "35 completed sessions"/"98% satisfied" are not
> computable from any endpoint.

## S13 — `/{locale}/bookings/[id]/review`

### Defects found

1. **The POST result is discarded.** `PostSessionReviewContent.handleSubmit`
   (`:65-100`) awaits `callApi(...)`, then `finally { setIsSubmitting(false);
   setIsSuccess(true); }` sets success **unconditionally**. A rejected rating
   (400/403/409 — already rated, not eligible) still renders the green
   "verified" toast and redirects to `/bookings`. Note `callApi` does **not**
   throw on non-2xx (`lib/api-client.ts`), so `res.ok` must be checked.
2. **A blank comment is replaced by a canned sentence** (`:80-82`),
   fabricating user-authored text. `createRatingSchema` requires
   `comment.trim().min(1)`.
3. **Only one number is sent.** Four per-criterion ratings are collected
   (`:20-25`), averaged locally (`:71-79`), and the originals discarded.
4. **Hardcoded session data** — avatar `LA`, tutor `Lan Anh`
   (`en.json:737`), class title (`:736`), topic (`:741`), `1080p Clear Video`
   (`:743`), `Duration: 60 minutes` (`:731`), `90 Credit` / `+81` / `9` / `150`
   (`:249,265,272,283`), and two fake downloadable files (`:760-763`).
5. **The whole cross-matching block** (`:613-654`) is presented as functionality
   with no backend field, plus `handleDownload`/`downloadNotice` (`:58-63`).

### Decisions

- **Success only on confirmation.** Gate on `res.ok`; on failure render an
  inline error using the API's own `message`. No redirect on failure.
- **Require the comment.** Disable submit until the trimmed comment is non-empty.
  Delete the canned default.
- **Submit the overall rating; label the criteria honestly.** The API has one
  `stars`. The four criteria remain a **private self-assessment aid** and the UI
  says explicitly that only the overall score is submitted — nothing implies a
  per-criterion value was stored.
- **Load the real booking.** `GET /classes/bookings/me`, find by route id; use
  real `classSummary.{description,teacherDisplayName,startsAt,durationMinutes}`,
  `priceCredits`, `state`, `ratingEligible`, `hasRated`. Explicit loading /
  not-found / already-rated / not-eligible states.
- **Derive money, reusing the canonical helpers.** `computePlatformFee` /
  `computeNetCredits` from `lib/teacher/mock-data.ts` (moved to a neutral module,
  see below) — not re-derived inline, so odd-credit rounding can't drift from
  `PricingRevenueCard`. Balance from `GET /wallet/balance`.
- **Materials and cross-matching marked unavailable.** No endpoint or entity
  exists. Remove the fake files, the download handler and the cross-match block;
  show an honest "not available yet" line.

## D4 — two disagreeing publish surfaces

### Defects found

`/{locale}/teach/classes/new` (`PublishForm.tsx`):
- already calls the real `POST /classes` (`:92-106`) but **swallows failure**
  (`console.warn(...fallback to mock result)`) and then **reports success from
  `MockTeacherPublishGateway`** (`:111`);
- **fabricates** `classroomCode = SS-<id tail>` (`:114`) — no such field exists
  on `createClassSchema` or any class response;
- writes a third copy into `skillswap_created_classes` (`:118+`);
- `PublishForm.test.tsx` asserts on `demoVerifiedSkills`/`buildDemoDraft`.

`/{locale}/instructor`:
- reads `GET /classes?teacherId=me` correctly (`:47`) **and** a hand-rolled
  create-class modal that is a *second* writer of `skillswap_created_classes`
  (`:187`) and a second `POST /classes` path (`:160`);
- three hardcoded class cards (`:507-617`) including a fabricated UUID
  (`:540`) and a fake booking link (`:537`);
- fake KPIs: `35 buổi học` (`:299`), `100% đúng giờ` (`:302`),
  `4.9 / 5.0` (`:317`), `31 nhận xét` (`:320`), `98% hài lòng` (`:324`);
- fake identity: `VNU-2021-0988` and faculty (`:232`), name fallback `Lan Anh`
  (`:226`), avatar `LA` (`:218`), demo skill fallbacks (`:367-424`, `:674-675`);
- `showClassReview` fabricates `5/5 sao` (`:137`); `copyShareLink` emits
  `/lop-hoc/<code>` (`:132`), a route that does not exist.

`checkout/page.tsx` (`:47-59`): a **third** consumer of
`skillswap_created_classes`, fabricating `teacherName: 'Giáo viên'`.

### Decisions

- **One publish path (net-new code).** Create
  `lib/teacher/http-gateway.ts` — `HttpTeacherPublishGateway` — publishing through
  the real `POST /classes` with failures propagated. `PublishForm` calls it
  directly; the mock fallback and `MockTeacherPublishGateway` are deleted.
- **Verified skills from the real endpoint.** `GET /profile-skills/me` →
  `ProfileSkillView` has `skillId`, `skillName`, `category`, `approvedLevel`.
  It does **not** return `verifierLabel`, `verifierFaculty` or `approvedOn`, so
  `VerifiedSkill` drops those three fields and the picker shows skill name +
  category + approved level only. No invented verifier name.
- **Drop `classroomCode` from the UI.** The room is minted at access time
  (`POST /classes/bookings/:bookingId/room-access`); the publish screen must not
  display a code. `PublishResult` loses the field; `PublishForm.tsx:114` and
  `:210` are removed in the same commit.
- **Keep the money helpers.** `computePlatformFee`/`computeNetCredits` move out
  of `mock-data.ts` into `lib/teacher/money.ts`; `PricingRevenueCard` and the S13
  settlement import from there. The rest of `mock-data.ts` (demo fixtures) is
  deleted once no production file imports it.
- **Delete `skillswap_created_classes` everywhere** — `PublishForm`,
  `instructor` modal, `instructor` list merge, and `checkout` fallback. All
  three read server state instead.
- **`/instructor` shows only real data.** Real class list from
  `GET /classes?teacherId=me`; remove the fabricated cards, the fake UUID/link,
  the fake identity strings, the fabricated review toast and the dead share
  route. Keep `availableCredits`/`pendingCredits` (real). Omit
  completed-session and satisfaction metrics — they are not computable — and
  omit `averageRating`/`ratingsCount` in copy while the schema marks them
  provisional.

## Phases (one commit each)

1. **1E-a — money module + S13 rating.** `lib/teacher/money.ts`; rewrite
   `PostSessionReviewContent`; locale keys for new states in `en.json` + `vi.json`.
2. **1E-b — D4 publish.** `HttpTeacherPublishGateway`, `VerifiedSkill`/
   `PublishResult` shape, `PublishForm` real-only, page wiring, delete teacher
   mock gateway + test, rewrite `PublishForm.test.tsx`.
3. **1E-c — de-shadow localStorage.** Remove `skillswap_created_classes` from
   `PublishForm`, `instructor` (list + modal) and `checkout`; drop `/instructor`
   fakes.
4. **1E-d — verify + docs.** `pnpm verify`; update the parity matrix.

## Out of scope (recorded, not faked)

- Per-criterion ratings are not persisted — no backend field.
- `averageRating`/`ratingsCount` are provisional per `mobile-classes.ts:176`.
- `BookClassUseCase` verified-student eligibility check.
- Marketplace `DEFAULT_QUERY` still imported from `marketplace/mock-gateway` (1F).
