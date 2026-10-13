# Plan — close the one-sided API coverage gaps (web ↔ mobile)

Status: proposed · Date: 2026-10-13 · Branch: `feat/midterm-presentation-readiness`

## Problem

The FE guide (`docs/api/FRONTEND-API-GUIDE.md`) defines the booking lifecycle. An
audit of both clients against it found that **no endpoint is missing from both
clients**, but four endpoints are reachable from only one:

| Endpoint | Web | Mobile | Consequence |
|---|---|---|---|
| `POST /classes/:id/start` | ❌ | ✅ | A teacher on web can *complete* a class but can never *start* one. |
| `PATCH /classes/:id` | ❌ | ✅ | A teacher on web cannot edit a published class (price/capacity/time). |
| `POST /classes/bookings/:bookingId/no-show` | ✅ (gap) | ✅ (gap) | **Corrected during implementation — see below.** |
| `POST /wallet/top-ups/callback` | ✅ (dev only) | ❌ | Provider-owned callback; the web server action is a dev simulation. **Out of scope** — a client should not call it, per the guide. |

`PATCH` and `start` are also the two endpoints the *web teacher dashboard* most
obviously lacks: the dashboard already renders a per-class card with a
"Hoàn thành" (complete) button, so the missing verbs are visible to a user.

## Scope

In scope: `POST /classes/:id/start` and `PATCH /classes/:id` on web;
`POST /classes/bookings/:bookingId/no-show` on mobile.

Out of scope: `/wallet/top-ups/callback` (provider-owned); any new endpoint,
schema, ADR, or migration. Every call below already exists on the server.

## Constraints (from ARCHITECTURE.md / AGENTS.md / DESIGN.md)

- **Client work only.** No API, gateway, contract, or DB change. The three
  endpoints already exist and already return the documented envelopes.
- **Honesty rule.** Success is shown only when `res.ok`. On failure the screen
  surfaces the API's own `message`. No optimistic UI, no fabricated state.
- **Money stays integer credits.** The edit form must not introduce floats.
- **Design register `product`.** Reuse the existing card, pill-button, slate +
  emerald tokens in `instructor/page.tsx`. No new visual language.
- **i18n.** The instructor page is currently Vietnamese-only (hardcoded vi
  strings). Follow the surrounding file rather than introducing `next-intl`
  keys mid-file; a full i18n pass is a separate change.
- **Client contract handling.** Web `callApi` never throws on non-2xx — always
  check `res.ok` and read `unwrapEnvelope`.

## Phases

### Phase 1 — web: start a class
`apps/web/src/app/[locale]/instructor/page.tsx`

- Add `handleStartClass(classId)` mirroring `handleCompleteClass`: `POST
  /classes/:id/start`, then re-read `/classes?teacherId=me` so the card shows
  server truth.
- Add a "Bắt đầu" (start) pill before "Hoàn thành" on non-completed cards,
  shown only when the class can legally start (`published` / `full`), matching
  the server's transition rule. A `409` surfaces the API message.
- Both buttons share `isProcessing` to prevent double-submits.

### Phase 2 — web: edit a class
`apps/web/src/app/[locale]/instructor/page.tsx` (inline panel) + a small
`editDraft` mapper next to `TeacherClassItem`.

- Add an "Sửa" (edit) pill opening an inline panel with `priceCredits` and
  `capacity` only. Rationale: those are the two fields the API accepts that a
  teacher changes in practice, and they are the two with local validators
  already (`priceIsValid`, `capacityIsValid` in `lib/teacher/money.ts`).
  Schedule/skill edits are deferred — changing `startsAt` interacts with the
  24 h booking lead time and deserves its own review.
- `PATCH /classes/:id` with only the changed fields. A `409 ClassLockedError`
  (class has a confirmed booking) surfaces the API's message and closes the
  panel without changing anything.
- Validate locally with the existing helpers; the server remains authoritative.

### Phase 3 — mobile: declare a teacher no-show
`apps/mobile/src/infrastructure/http/teaching-gateway.ts` + spec

- Add `reportTeacherNoShow(bookingId)` calling `POST
  /classes/bookings/:bookingId/no-show` via `authenticatedRequest`, returning
  the server's `{ cancelled }` result rather than discarding it.

**Correction found while verifying against the live stack.** The audit described
this endpoint as "a teacher reports a learner no-show". That is wrong. Reading
`mark-teacher-no-show.use-case.ts` and `classes.controller.ts`:

- It is `MarkTeacherNoShow` (FR-007 / AC-024, ADR-019): it cancels a *confirmed*
  booking when the **teacher** did not join within the first 15 minutes of the
  class, refunding the **learner** via `booking.cancelled`.
- It is learner protection, not teacher enforcement. There is no
  "learner did not attend" endpoint.
- It answers `200 { cancelled: false }` before the window closes. That is a
  refusal, not a failure, so the client returns the result instead of treating
  non-cancellation as an error.
- The controller takes no identity argument (line 154: `teacherJoinedAt: null`
  is hardcoded until FR-011 supplies join evidence), so the route cannot
  distinguish the caller. Live-stack proof: a *learner* token calling it got
  `200`, not `403`. Recorded as a known server-side authorization gap below —
  not a client fix, and not something this plan may paper over.

Consequence: the gap was real (no client called it) but its description was
wrong. The mobile client now models what the endpoint actually does. Exposing it
in a screen is deferred: it is a learner-facing protection triggered by an
elapsed window, and no mobile screen currently owns that concept.

### Phase 4 — tests
- Web: unit tests for the `start` and `edit` handlers (success + 409 + 401),
  asserting the screen calls the right path and surfaces the API message. Prove
  each test fails against the pre-change code.
- Mobile: unit test for `reportNoShow` mapping (path, method) and error
  propagation, following the existing `teaching-gateway` spec style.

### Phase 5 — docs
- Update `docs/api/FRONTEND-API-GUIDE.md` row coverage only if it names client
  support; otherwise leave it (it describes the API, not the clients).
- Record the remaining asymmetry (`/wallet/top-ups/callback` web-only) as a
  known, intentional difference rather than a gap.

## Verification

1. `pnpm verify` green (lint, build, typecheck, test, arch).
2. Manual: with the stack up, a teacher account can start, edit and complete a
   class from web; a `409` shows the server's message.
3. No new lint warnings; no float money; no mock reached from production code.

## Risks

- The start transition rule lives in the API. If the web shows the button for a
  state the server rejects, the user sees a `409` — acceptable (honest) but the
  button should be gated to `published|full` to avoid the common case.
- Editing `capacity` below `confirmedBookingsCount` should be rejected by the
  server; the web must not silently clamp it.

## Findings that are *not* client work (recorded, not fixed here)

### F1 — `/classes/bookings/:bookingId/no-show` has no caller identity check
`ClassesController.noShow` (`classes.controller.ts:154`) takes no `@Req()`. Proof
against the live stack: a **learner** token calling a **teacher-only** lifecycle
route received `200 { cancelled: false }`. The use case does guard state and
window, but not *who* is asking. Any authenticated account can attempt to cancel
any booking for `teacher_no_show`. This is a server-side authorization defect;
fixing it means touching the API and needs its own plan. Not changed here.

### F2 — the endpoint is learner protection, not learner enforcement
There is no "teacher marks a learner absent" route anywhere in the API. Recorded
so the next reader does not repeat the audit's mistake.

### F3 — `GET /classes/:id` followed by an unrelated `no-show` is observable
Because the route is unauthenticated-by-identity and takes `bookingId`, the only
thing standing between a stranger and a booking cancellation is the booking id's
unguessability (a UUID) plus the 15-minute window. Noted as a consequence of F1.
