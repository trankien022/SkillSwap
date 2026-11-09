# Plan — fix the defects found during end-to-end flow testing

**Date:** 2026-11-10
**Branch:** `fix/flow-testing-defects` (off `main` @ `7e11943`)
**Status:** planned

## Context

Fifteen end-to-end flows were exercised against the deployed product. Nine defects
were recorded and deliberately left unfixed. This plan fixes them.

Two of the original nine were consequences of deployment configuration, not code, and
have since resolved themselves:

- **#8 CORS** — `access-control-allow-origin` is now present and `OPTIONS` returns 204,
  so `/en/status` no longer reports Gateway Unreachable. Nothing to fix in code;
  the fix is that `CORS_ORIGINS` is set on Render.
- The 502 on `/api/health` was an outage, not a defect.

That leaves seven. They are ordered by blast radius, not by number.

## Severity, and why this order

| Order | Defect | Why here |
|---|---|---|
| 1 | **#2 escrow release does nothing** | Wrong money outcome for a real user action. Everything else is cosmetic by comparison. |
| 2 | **#1 publish blocked on first load** | Blocks the teacher's only path to earning. A silent, repeatable blocker. |
| 3 | **#6 raw UUIDs in admin + studio** | Leaks internal identifiers to operators; also the one the user sees most often. |
| 4 | **#5 wallet history shows raw refs** | Same class of leak, on the money screen. |
| 5 | **#3 Vietnamese copy on /en** | Wrong language on notifications. Visible, low risk. |
| 6 | **#7 validation errors as raw JSON** | Unhelpful, but the operation still fails safely. |
| 7 | **#9 pluralisation nits** | Cosmetic. |

## Phase 1 — #2 "Confirm & Release Escrow" does nothing

### What is actually wrong (confirmed by reading the code, not guessed)

Four separate faults behind one symptom:

1. **The wrong endpoint, and a silent one.** `confirmBooking` POSTs
   `/classes/bookings/:id/confirm`, which the API documents as *"Confirm a pending
   booking and settle payment"* (`classes.controller.ts:124`). On a booking that is
   already `confirmed` the repository returns `{ confirmed: false }` **instead of
   erroring** (`sql-booking-repository.ts:174`), so the web client saw HTTP 200,
   treated it as success, and moved on. The button "did nothing" precisely because
   the failure was designed out one layer below it.
2. **The rating is conditional on the comment.** `http-gateway.ts:101` submitted the
   rating only `if (review.body.trim().length > 0)`. A learner who picks 5 stars and
   types no comment submits **no rating at all** — matching the observed "0 ratings
   after two clicks".
3. **Escrow release is not a user action.** Release happens on `class.completed`
   through the outbox → `wallet-ledger` (ADR-021 §6). There is no release endpoint.
   The button's label and the modal's subtitle ("Confirm that the session was
   completed successfully to release the held credits") promise a capability the
   product does not have — and must not have, since a learner-triggered release
   would let the payer move the payee's money.
4. **Eligibility was inferred from the clock.** The card offered the review whenever
   the scheduled end had passed, but the rating endpoint requires the class to be
   `completed`. Between the scheduled end and the completion sweep the form appeared
   and was then refused. The view model now carries the server's own
   `ratingEligible`/`hasRated` flags instead.

### Decision

The button becomes what the product actually offers: **submit the review**. It
always submits the rating, never calls `/confirm`, and is offered only when the
server says it will accept one. The copy states that the credits release
automatically at the end of the session.

Money is untouched — release stays with the completion sweep. This is the only
honest reading: the learner's leverage over escrow is the no-show report and the
review, not a release button. Recorded as
[ADR-021 Amendment C](../../adr/ADR-021-class-completion-rule.md).

### Files

- `apps/web/src/lib/dashboard/http-gateway.ts` — `confirmBooking` → `submitReview`,
  `/confirm` leg deleted, rating unconditional.
- `apps/web/src/lib/dashboard/{types.ts,api-my-bookings.ts}` — carry
  `ratingEligible`/`hasRated` through to the view model.
- `apps/web/src/components/dashboard/{SessionCard,DashboardShell}.tsx` — review
  control gated on eligibility; dead `AlarmIcon` and the permanent `0h:00m`
  countdown chip removed.
- `apps/web/src/messages/{en,vi}.json` — label, subtitle and escrow-rule copy.
- Tests in `lib/dashboard/http-gateway.test.ts` (4 new, all fail against the
  pre-fix code).

### Done when

- A 5-star review with no comment persists exactly one rating.
- No request reaches `/confirm` for a completed booking.
- Copy does not promise a release the learner cannot cause.

## Phase 2 — #1 publish blocked on first load

**Needs reproduction first.** The report is "Subject verified: Not met" until the
subject is re-picked. I will drive the real publish form against the deployed API
and capture the request body and the eligibility response before changing code,
because the fix differs depending on whether the gate is evaluated with an empty
skill id or with a correctly-shaped one that the server rejects.

## Phase 3 — #6 raw UUIDs to operators

`instructor/page.tsx:272-273` renders `{ui('id')}{s.skillId.slice(0,8)}`, and
`:423` renders `{item.id.slice(0,8)}` as a bare class code. Truncating a UUID is not
anonymising it, and it means nothing to a human.

Replace with what the person is actually looking for: the skill name and level on
the skill card, and the class title plus start time on the class card. Remove the
`ID:` copy key. Where a stable short code is genuinely needed (the classroom header
shows `CLASS CODE: #5eedc1a5`), keep it — that one is a room reference, not a leak
of an entity id from a list.

## Phase 4 — #5 wallet history shows raw refs

Ledger entries render `demo-seed-booking-…` and live UUIDs as the reference. Map
the ledger `ref` to the human thing it points at (class title, top-up, refund), and
show the raw ref only in a detail/tooltip. Needs a look at what the wallet read
actually returns before choosing whether the join belongs in the API or the client.

## Phase 5 — #3 Vietnamese copy on `/en`

`routing.defaultLocale` is `'en'`, so the earlier note blaming `DEFAULT_LOCALE='vi'`
is imprecise. The likely cause is a hardcoded Vietnamese string or a
locale-independent constant inside the notification producer. Locate the string,
make it locale-aware or move it to the message catalogue, and add a test that
`/en/notifications` contains no Vietnamese diacritics.

## Phase 6 — #7 validation errors as raw JSON

**Needs reproduction first.** The envelope renders zod issues as `field: message`
(`domain-error.filter.ts:248-264`) and the local pipe does the same, so a
well-formed caller should already read prose. Something is showing the body
verbatim — find which surface, then make it read `message` like every other caller
(`readApiMessage`). If the culprit is a `Res`-returning handler or a page rendering
`JSON.stringify(body)`, fix that surface rather than the shared helper.

## Phase 7 — #9 pluralisation

"1 available seats", "1,542 credit", "1 messages". Introduce `Intl.PluralRules`-backed
count strings in the catalogue for the three affected keys, both locales.

## Out of scope

- **#4 unread badge** — investigated during planning: only `notifications/page.tsx`
  passes `unreadNotificationsCount`; every other page omits it, and the badge reads
  0. Fixing it means fetching the count per page or lifting it into a shared layout.
  That is a layout change with a fan-out well beyond a defect, so it gets its own
  PR rather than riding along with these.
- Anything requiring a new API route.
- The render/8x8 configuration items.

## Verification per phase

`pnpm verify` green before each commit. Each phase is one commit with a body that
explains the money or leak consequence, not just the diff.

## Risks

- **Phase 1 changes a money-adjacent control.** The mitigation is that release is
  *not* moved: it stays with the completion sweep, and this phase removes a button
  that implied otherwise. No new endpoint, no new permission.
- **Phase 2 and 6 are unfixed guesses until reproduced.** Deliberately sequenced
  after Phase 1 for that reason.
