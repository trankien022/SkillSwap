# Plan — fix the defects found during end-to-end flow testing

**Date:** 2026-11-10
**Branch:** `fix/flow-testing-defects` (off `main` @ `7e11943`)
**Status:** phases 1–7 landed

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

### What is actually wrong (confirmed by reading the code)

`routing.defaultLocale` is `'en'`, so the earlier note blaming `DEFAULT_LOCALE='vi'` was
right about the constant but wrong about the cause. Both were needed:

- `SqlNotificationManagement.readLocale` resolves the inbox language from the account's most
  recently updated **active push device**, and falls back to `DEFAULT_LOCALE = 'vi'`.
- The web client registers **no** push device — it never calls `POST /notifications/devices`,
  because it has no push tokens. Every web-only account therefore took the `vi` fallback.
- The reader's own language was never consulted at all: `GET /notifications` ignored
  `Accept-Language`, and nothing in `apps/api/src` read the header.

So a user on `/en/notifications` read Vietnamese titles over a page whose every other string was
English. `notificationCopy` already carried both languages; only the choice of which one was wrong.
The mobile audit plan had already logged this as risk R-05.

### Decision

Request language → device language → one shared constant, in that order.

- `apps/api/src/shared/http/accept-language.ts` — `localeFromAcceptLanguage`, narrow on purpose:
  returns `vi`, `en` or `undefined`, honours `q=0` and caller ordering, ignores `*` and unsupported
  languages rather than guessing.
- `notifications.controller.ts` passes it to the adapter read.
- `DEFAULT_NOTIFICATION_LOCALE = 'en'` beside `notificationCopy`, used by both the inbox fallback
  and `PushDeliveryWorker`, so one event cannot arrive as two different strings per channel. The old
  push default was `'vi'` too.
- `readLocale` now names both supported languages. Its old
  `locale === 'en' ? 'en' : DEFAULT_LOCALE` shape only worked while the default was `vi`; flipping
  the default without this would have turned every Vietnamese device English.
- `fetchNotifications(locale)` sends `Accept-Language`; the page re-fetches on locale change.

Recorded as [ADR-041](../../adr/ADR-041-notification-language-negotiation.md).

### Done when

- `/en/notifications` renders English and `/vi/notifications` Vietnamese, same account, no device.
- A request with no header keeps the old behaviour, except that the no-device default is now `en`.
- Push and inbox agree on their fallback (parity test).

### Proof

The three adapter tests in `sql-notification-management.spec.ts` and the two controller tests fail
against the pre-fix resolution. The controller test could not even be *written* against the old
signature — `list` took three arguments and rejected a fourth at compile time.

## Phase 6 — #7 validation errors as raw JSON

### Reproduction (the plan's guess was wrong)

The plan suspected a surface printing a response body. Reproduced instead: the API's
envelope is prose on every reachable path — verified live against the local API
(`POST /auth/register` → `"email: Invalid email; displayName: Required"`,
`POST /classes` → `"skillIds: Required; title: Required; …"`). No caller in
`apps/web/src` renders a body: no `.text()`, no `JSON.stringify`, no `<pre>`.

The JSON is generated **client-side**. Every `schema.parse(...)` from
`packages/contracts` throws a `ZodError`, and `ZodError#message` is
`JSON.stringify(issues, null, 2)`:

```
[
  {
    "code": "too_big",
    "maximum": 5,
    "type": "number",
    ...
    "message": "Number must be less than or equal to 5",
    "path": ["stars"]
  }
]
```

Caught and rendered as `err.message`, that document is what the reader saw. The
trigger is any contract drift or unexpected response shape — which is exactly why it
was reachable during flow testing and not from the happy path.

### Fix

`apps/web/src/lib/error-message.ts` — `describeError(error, fallback)`:

- `ZodError` → its issues as `field: message`, joined by `; `. This is the same prose
  the API's own filter produces (`domain-error.filter.ts`), so the reader sees one
  shape whichever side rejected the input.
- Any other `Error` → its message, which is already the API's prose.
- A blank message, a serialised blob (`{…}`/`[…]`), or a non-`Error` → the caller's
  fallback. A screen always words that better than a shared helper can.

Applied at every surface that rendered `err.message` (28 call sites, 20 files), so the
trap cannot be re-entered by the next component that copies its neighbour.

### Also fixed here: two generated catalogue keys

Both were reachable from real screens, and both are what a template literal key looks
like when its variable was `undefined`:

- `Workspace.copy.errorundefined` (`"Error: "` / `"Lỗi: "`) was concatenated in front
  of the real message on the checkout and instructor pages, so every failure read
  `Error: …` with an internal key baked into the catalogue. Replaced by `describeError`.
- `Workspace.copy.publishAClassundefined` → renamed `publishAClassLink` (the link to
  the publish workspace).

Both entries deleted. `messages-parity.test.ts` gains a guard: no key may contain a
segment ending in `undefined`. Restoring one key fails that test by naming it.

### Proof

- `error-message.test.ts` (9 tests) drives real contract schemas
  (`walletBalanceSchema`, `topUpRequestSchema`), asserting prose, no braces/brackets,
  no issue codes, no newlines.
- `verifier-queue.test.tsx` renders the page against a response that breaks its
  contract. Pre-fix it fails on `expect(container.textContent).not.toContain('"code"')`
  — the DOM literally held the serialised issues.
- Adding `errorundefined` back to `en.json` fails
  `no keys built from an undefined variable` with `['Workspace.copy.errorundefined']`.

## Phase 7 — #9 pluralisation

### Reproduction

The report listed three: "1 available seats", "1,542 credit", "1 messages". All three
are the same shape — the number is interpolated *beside* a fixed noun, so the noun
cannot agree with it:

- `Workspace.copy.availableSeats` = `"available seats"`, rendered as
  `{item.availableSeats} {ui('availableSeats')}` in `instructor/page.tsx`.
- `LiveClassroom.chat.total` = `"{total} messages"` in the classroom chat header.
- `Workspace.wallet.credits` = `"credits"`, and `Workspace.checkout.credits` likewise,
  appended to a `toLocaleString()` number on the wallet summary, the ledger rows and
  the checkout summary. `PostSessionReview.escrow.credits` = `"{n} Credits"` had the
  same fault and inconsistent casing with it.

### Fix

ICU plural syntax in the catalogue, not a `count === 1` branch in each component. The
catalogue already used it once (`Teacher.publish.step1VerifiedBadge`), and ICU plurals
are resolved by `Intl.PluralRules`, so the correct form per locale comes from the
platform rather than from whoever wrote the component.

The count moves *into* the message. Two things follow, and both are the point:

- `#` renders the number, and it formats it for the locale — so the component no
  longer calls `toLocaleString()` and can no longer disagree with the copy.
- The noun and its number are one translatable unit. A translator sees
  `{count, plural, one {# credit} other {# credits}}` and knows what the number
  governs, which is impossible when the number lives in the TSX.

**Vietnamese is deliberately not built as a plural.** `Intl.PluralRules('vi')` reports
a single category, so `{count} credit` and `{count} chỗ trống` are already correct for
every count. Writing `{count, plural, …}` there would add branches that render
identically — maintenance cost with no reader benefit. The tests assert the two
locales behave differently for that reason.

`creditUnit` is a new bare label for the places that name the unit without counting
anything — the exchange-rate line (`1 credit = 1.000 VND`) and the amount-input
suffix. Those must not go through the plural, because there is no count to agree with.

### Proof

`plural-forms.test.ts` (8 tests) runs the real `createTranslator` against the real
catalogues, so it asserts the message every call site shares rather than one
component's copy. Against the pre-fix catalogue all 8 fail, and they fail on the
reported strings: `expected 'available seats' to be '1 seat available'`,
`expected '1 messages' to be '1 message'`, `expected 'credits' to be '1 credit'`.

A no-argument audit over every `.ts`/`.tsx` in `apps/web/src` confirms no surviving
`t('credits')` / `t('availableSeats')` / `t('total')` call that would now render an
empty slot. TypeScript cannot see that mistake — the second argument is optional — so
it is checked mechanically instead.

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
