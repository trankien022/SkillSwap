# Screen parity matrix — Web ↔ Mobile

> Phase 0 of [2026-10-12-midterm-presentation-readiness-plan.md](./2026-10-12-midterm-presentation-readiness-plan.md).
> Audit date: **2026-10-12** · Branch: `feat/midterm-presentation-readiness` · Base commit: `7354c31`
> Method: source-code audit with `file:line` evidence. Not derived from generated docs, which are stale.

## Why this document exists

The checkpoint rubric scores Frontend (15%) and Integration (10%) on the clients mirroring each other. Today they **do not**: Mobile talks to the real API across nearly every screen, while Web serves the marketplace, class detail, dashboard and publish flow from local mocks. If both clients are demoed side by side, those screens visibly disagree.

This matrix is the contract for Phase 1. Every row is a screen, its route in each client, the endpoint that *should* back it, and its current status.

## Assumption to state when presenting

Neither `SkillSwap-SRS.md` nor `SkillSwap-PRD.md` contains an explicit screen inventory — they specify requirements (`FR`/`BR`), not screens. **The 17 screens below are derived** from SRS §3.1.1 + PRD §6.1–6.10. Phase 3 adds this list to the SRS so it stops being an inference.

---

## 1. Status legend

| Symbol | Meaning |
|---|---|
| ✅ Real | Calls the real API over HTTP |
| ⚠️ Partial | Real API for some data, local/mock for the rest |
| ❌ Mock | Serves from an in-repo mock gateway or hardcoded fixtures |
| ➖ N/A | No data needed, or the screen does not exist in that client |

## 2. The parity matrix

| # | Screen | Web route | Mobile route | Endpoint that should back it | Web | Mobile |
|---|---|---|---|---|---|---|
| S1 | Landing / Home | `/{locale}` | `app/index.tsx` | none (static) | ✅ none | ➖ guard |
| S2 | Learner dashboard | `/{locale}/bookings` | `(tabs)/index.tsx` → `dashboard-view.tsx` | `GET /classes/bookings/me` + `GET /wallet/balance` | ✅ Real | ✅ Real |
| S3 | Marketplace | `/{locale}/classes` | `(tabs)/explore.tsx` → `marketplace-view.tsx` | `GET /classes` + `GET /skills` | ✅ Real | ✅ Real |
| S4 | Class detail | `/{locale}/classes/[id]` | `classes/[id].tsx` → `class-detail-view.tsx` | `GET /classes/{id}` | ✅ Real | ✅ Real |
| S5 | Login | `/{locale}/auth` (`/login` redirects) | `(auth)/login.tsx` | `POST /auth/login` | ✅ Real | ✅ Real |
| S6 | Register | `/{locale}/auth` (`/register` redirects) | `(auth)/register.tsx` | `POST /auth/register` | ✅ Real | ✅ Real |
| S7 | Wallet | `/{locale}/wallet` | `(tabs)/wallet.tsx` | `GET /wallet/balance`, `GET /wallet/history` | ✅ Real | ✅ Real |
| S8 | Top-up / checkout | `/{locale}/classes/[id]/checkout` | `wallet-view.tsx` | `POST /wallet/top-ups`, `POST /classes/{id}/bookings` | ✅ Real | ✅ Real |
| S9 | Student verification | `/{locale}/verification` | `(features)/verification.tsx` | `GET/POST /student-verifications` | ✅ Real | ✅ Real |
| S10 | Skills / evidence | `/{locale}/skills` | `(features)/skills.tsx` | `GET /skills`, `GET /profile-skills/me`, `POST /skill-evidence` | ✅ Real | ✅ Real |
| S11 | Withdrawal | `/{locale}/wallet/withdrawal` | `wallet-view.tsx` | `GET /wallet/balance` (submit has **no** endpoint) | ⚠️ Partial | ➖ not built |
| S12 | My classes / teaching | `/{locale}/instructor`, `/{locale}/teach/classes/new` | `(features)/teaching.tsx` | `POST /classes`, `PATCH /classes/{id}`, `POST /classes/{id}/complete` | ✅ Real | ✅ Real |
| S13 | Post-class rating | `/{locale}/bookings/[id]/review` | `my-bookings-view.tsx` | `POST /classes/bookings/{id}/rating` | ✅ Real | ✅ Real |
| S14 | Jitsi classroom | `/{locale}/bookings/[id]/live` | `my-bookings-view.tsx` | `POST /classes/bookings/{id}/room-access` | ✅ Real | ✅ Real |
| S15 | Profile | Navbar only | `(tabs)/profile.tsx` | session | ⚠️ Partial | ✅ session |
| S16 | System status | `/{locale}/status` | — | `GET /health` | ✅ Real | ➖ |
| S17 | Notifications | `/{locale}/notifications` | `(features)/notifications.tsx` | `GET /notifications`, `POST /notification-devices` | ❌ Hardcoded | ✅ Real |

**Tally (after `f34d278` merge + Phases 1A–1G):** Web 14 real / 2 partial / 1 mock-or-missing (S17 hardcoded). Mobile 12 real / 4 session-or-guard / 1 not built.

---

## 3. Evidence

### Web — mock and missing (the Phase 1 work)

| Screen | Evidence |
|---|---|
| S2 | `apps/web/src/app/[locale]/bookings/page.tsx:7` imports `MockLearnerDashboardGateway` |
| S3 | `apps/web/src/app/[locale]/classes/page.tsx:6,25` + `components/marketplace/MarketplaceClient.tsx:12-13,22` instantiate `MockMarketplaceGateway` |
| S4 | `apps/web/src/components/marketplace/ClassDetailContent.tsx:2,21` imports `MockClassDetailGateway` |
| S12 | `apps/web/src/app/[locale]/teach/classes/new/page.tsx:7` imports `MockTeacherPublishGateway` |
| S13 | `components/review/PostSessionReviewContent.tsx` — local state, no `callApi` |
| S17 | `apps/web/src/app/[locale]/notifications/page.tsx` — 7 hardcoded items in component state |
| S10 | No route exists under `apps/web/src/app/[locale]/` for skills |

Presentation components also read formatting helpers from `lib/marketplace/mock-data` (`ClassCard.tsx:8`, `ScheduleSection.tsx:2`, `StickyBookingCard.tsx:3`) — these need to survive the swap.

### Web — already real

| Screen | Evidence |
|---|---|
| S7 | `apps/web/src/app/[locale]/wallet/page.tsx` — `/wallet/balance`, `/wallet/history`, `/wallet/top-ups` |
| S8 | `apps/web/src/app/[locale]/classes/[id]/checkout/page.tsx` — `/wallet/balance`, `POST /classes/{id}/bookings` |
| S9 | `components/verification/VerificationContent.tsx:31-35,73,89` |
| S12 | `apps/web/src/app/[locale]/instructor/page.tsx:43-47` — `/profile-skills/me`, `/wallet/balance`, `/auth/me` (but `newClasses` persisted in `localStorage:35`) |
| S14 | `components/classroom/LiveClassroomContent.tsx:46` |
| S16 | `components/status-check.tsx` + `lib/status.ts` |

### Mobile — real everywhere it matters

`session-context.tsx:97-101` builds one `GatewayClient`; the HTTP gateways live in `apps/mobile/src/infrastructure/http/`. Screens are thin route files re-exporting views in `src/ui/`.

---

## 4. Defects found during this audit

These are **not** in the original plan and were found by reading the code.

### D1 — `HttpBookingGateway` calls a nonexistent endpoint (dead code)

| | |
|---|---|
| Claim | `POST /classes/{id}/book` |
| Evidence | `apps/mobile/src/infrastructure/http/http-booking-gateway.ts:39` |
| Reality | No such route. `classes.controller.ts:79-185` declares `Post()`, `Post(':id/bookings')`, `Post('bookings/:bookingId/confirm')`, `Patch(':id')`, `Post(':id/cancel')`, `Post('bookings/:bookingId/no-show')`, `Post('bookings/:bookingId/room-access')`, `Post(':id/start')`, `Post(':id/complete')` — no `:id/book` |
| Severity | **Low today, high if revived.** `container.ts:14` wires it when `httpApiEnabled()`, but `BookingScreen` (`ui/booking-screen.tsx:40`) is imported by **nothing** — `grep` for `BookingScreen`/`booking-screen` across `apps/mobile` returns only its own declaration. So the wrong URL is currently unreachable. Its unit test stubs `fetch` (`http-booking-gateway.spec.ts:49-53`) and never validates the path, which is why it passes. (Note: the existing `no-orphans` dependency-cruiser warning points at `infrastructure/mock/hung-classes.ts`, **not** at `booking-screen.tsx` — the latter is orphaned but not flagged, so the lint warning is not evidence for this defect.) |
| Decision | Phase 1F: delete `HttpBookingGateway` + `BookingScreen` + `container.ts` wiring, **or** repoint to `POST /classes/{id}/bookings`. Needs an explicit choice |

### D2 — Duplicate mobile auth/wallet clients

`GatewayClient` (`gateway-client.ts:146-228`) and `infrastructure/auth/client.ts:62-133` both implement `/auth/login|register|refresh|logout|me`; two places also call `GET /wallet/balance` (`auth/client.ts:120`, `ui/wallet-service.ts:26`). Two code paths for one contract — decide whether to consolidate or document the split.

### D3 — S11 withdrawal has no endpoint

Web `wallet/withdrawal/page.tsx:295` renders a submit button that calls nothing. No withdrawal route exists in `wallet.controller.ts`. Per the plan we mark it honestly rather than invent an endpoint.

### D4 — S12 web publish path is split

Web `/instructor` calls the real API, but created classes are cached in `localStorage` (`instructor/page.tsx:35`) and `/teach/classes/new` uses `MockTeacherPublishGateway`. Two publish surfaces disagree.

### D5 — Mobile is mock-first without env

`api-config.ts:12,18-20`: with no `EXPO_PUBLIC_API_BASE_URL`, `httpApiEnabled()` is false and gateways fall back to mocks. **Demo risk:** forgetting the env var makes Mobile look mock-only again. Phase 5 checklist must set it.

---

## 5. Endpoint truth (verified against controllers)

Present and used by both clients:

| Method | Path | Controller |
|---|---|---|
| POST | `/classes` | `classes.controller.ts:79` |
| POST | `/classes/:id/bookings` | `classes.controller.ts:97` |
| POST | `/classes/bookings/:bookingId/confirm` | `classes.controller.ts:113` |
| PATCH | `/classes/:id` | `classes.controller.ts:125` |
| POST | `/classes/:id/cancel` \| `/start` \| `/complete` | `classes.controller.ts:137,176,185` |
| POST | `/classes/bookings/:bookingId/room-access` | `classes.controller.ts:159` |
| GET | `/classes/bookings/me` | `my-bookings.controller.ts:38` |
| GET | `/classes/:id` | `class-detail.controller.ts` |
| GET | `/classes`, `GET /skills` | `class-list.controller.ts:26`, `skills.controller.ts:18` |
| POST | `/classes/bookings/:bookingId/rating` | `ratings.controller.ts:8` |
| GET | `/notifications` | `notifications.controller.ts:24` |
| POST/DELETE | `/notification-devices` | `notification-devices.controller.ts:14` |
| GET/POST | `/skill-evidence`, `/profile-skills` | `skill-evidence.controller.ts:33,82` |
| GET/POST | `/student-verifications` | `student-verification.controller.ts:48` |
| GET/POST | `/wallet/*` | `wallet.controller.ts:65` |
| — | `/auth/*` | `auth.controller.ts:30` |

**Reusable contracts** (so Phase 1 invents no schemas): `listClassesPageSchema`, `skillCataloguePageSchema`, `classDetailViewSchema`, `myBookingsPageSchema`, `createRatingSchema`, `notificationsPageSchema` — exported from `packages/contracts/src/index.ts:571-576`.

---

## 6. Phase 1 order, now corrected by evidence

| Step | Screens | Why this order |
|---|---|---|
| 1A | S3, S4 | **done** (`d2f6873`) — `HttpMarketplaceGateway` + `api-mapping.ts` |
| 1B | S8 | Money path — **done** (`3697fbc`). Web already used the real booking endpoint; the real work was removing `MockBookingGateway` from `booking-panel.tsx`, now replaced by `lib/booking/http-gateway.ts` |
| 1C | S2 | Needs `GET /classes/bookings/me` + `/wallet/balance`; several dashboard fields have no API → derive |
| 1D | S17 | Replace hardcoded data; endpoint + schema both exist — **partly done upstream** in `f34d278` (`lib/notifications/api-notifications.ts`) |
| 1E | S13, S12 | Rating endpoint exists; S12 must unify the two publish surfaces (D4) |
| 1F | D1, D2 | D1 **done** (`92c41bc`); D2 (duplicate auth clients) still open |
| 1G | S10 | Add the missing Web skills screen, mirroring `(features)/skills.tsx` |

---

## 7. Merge reconciliation with `origin/main` (`f34d278`)

While this branch was open, `f34d278` ("Fix UI web") landed on `main` and implemented its own marketplace API layer for the **same** screens. Both versions were merged; this records which survived and why.

### Kept from upstream

| Item | Reason |
|---|---|
| `lib/notifications/api-notifications.ts` (+ test) | Real notifications API layer with no equivalent here |
| `lib/dashboard/api-my-bookings.ts` (+ test) | Real my-bookings API layer |
| `lib/marketplace/api-class-detail.ts` (+ test) | Still used by the checkout page |
| All `docs/diagrams/**` refreshes | Phase 4 work delivered upstream — no longer needed here |
| Checkout, navbar, wallet, instructor, dashboard UI changes | Upstream UI fixes unrelated to this phase |

### Kept from this branch

| Item | Reason |
|---|---|
| `lib/marketplace/http-gateway.ts` | The live marketplace gateway |
| `lib/marketplace/api-mapping.ts` | Resolves skill name/category/level from the **real** `/skills` catalogue |
| `lib/booking/http-gateway.ts` | Real booking adapter (replaces `MockBookingGateway` in the panel) |
| Loading / sign-in / error states | Upstream rendered fake data instead |

### Removed (upstream code superseded here)

| File | Reason |
|---|---|
| `lib/marketplace/api-gateway.ts` (+ test) | Zero production callers after the merge. Its test asserted *"falls back to mock catalogue when network fails or user is unauthenticated"* — i.e. it **pinned displaying fake classes as correct behaviour**. Deleted with the file rather than left failing |
| `components/marketplace/ClientClassDetailFallback.tsx` | Only existed to render classes fabricated from browser `localStorage` |

### Field-quality difference (why the local version won)

| Field | Upstream | This branch |
|---|---|---|
| `skillName` | Truncated `description` | Real name from `/skills` |
| `skillCategory` | Hardcoded `'programming'` | Real catalogue category |
| `level` | Hardcoded `'intermediate'` | Real first level from catalogue |
| `ratingAvg` fallback | `?? 5.0` (invents a perfect rating) | `?? 0` (honest "unrated") |
| `schoolName` | Hardcoded `'Đại học Quốc gia'` | Neutral label |
| On API failure | Silent mock fallback | Explicit sign-in / error state |

---

## 8. Newly found after the merge — `localStorage` shadow state (money-relevant)

`f34d278` introduced a `localStorage` layer that **overrides real API responses**, which the audit did not previously capture:

| Key / helper | Written by | Overrides |
|---|---|---|
| `getStoredWalletBalance()` | `lib/api-client.ts:301` | Real `/wallet/balance` in navbar, wallet, checkout |
| `skillswap_created_classes` | `instructor/page.tsx:79,187`, `teacher/PublishForm.tsx:133` | The class list — classes that were never persisted |

Two consequences worth deciding on before the demo:

1. **Money display.** Checkout and the navbar prefer the stored balance (`override ?? remoteBal`), so a stale local value can disagree with the server. It is a display override, not a ledger write, so no incorrect settlement occurs — but the numbers shown can be wrong.
2. **Classes that do not exist server-side** appear in the marketplace and are bookable-looking, yet `POST /classes/:id/bookings` would reject them.

### 8.1 Resolution — money layer removed (commit pending)

The decision was to remove the shadow rather than tolerate it, because it sits on
the one path the rubric cares about most (Backend 25% + money rules). What changed:

| Site | Before | After |
|---|---|---|
| `lib/api-client.ts` | `getStoredWalletBalance()` read the key; `saveStoredWalletBalance()` wrote it | `getStoredWalletBalance()` always returns `null` **and deletes the key** (self-healing); the write helper is gone |
| `lib/api-client.ts` `dispatchWalletBalanceUpdate()` | saved to storage, then emitted | emits the `CustomEvent` only — instant same-page update, nothing persisted |
| `navbar.tsx` | `setInternalBalance(override ?? serverBal)` | `setInternalBalance(serverBal)` |
| `wallet/page.tsx` (load) | `setBalance(override ?? bal)` | `setBalance(bal)` |
| `wallet/page.tsx` (top-up) | computed `availableCredits + amountCredits` locally | refetches `/wallet/balance` after settlement |
| `checkout/page.tsx` (load) | `setBalance(override ?? remoteBal)`, plus a `skillswap_created_classes` fallback | server only |
| `checkout/page.tsx` (post-booking) | fabricated `currentCredits - priceCredits`; accepted the server value only `if (remote < current)` | refetches the balance; server is authoritative |
| `checkout/page.tsx` (quick top-up) | added 100 credits locally and reported "Nạp thành công" **without calling the API** | calls `POST /wallet/top-ups`, settles via the signed callback, then refetches |

Design rule now enforced (pinned by `apps/web/src/lib/api-client.test.ts`):
**wallet balance is server-owned state and is never cached.** The optimistic
*effect* (navbar updates the moment you book/top-up) is preserved via the
in-page event; the *persistence* is gone, so a reload or a different sign-in can
no longer show a figure that disagrees with the ledger.

### 8.2 Resolved in Phase 1C — `skillswap_user_bookings` removed

| Key / helper | Was written by | Behaviour before |
|---|---|---|
| `skillswap_user_bookings` | `lib/dashboard/api-my-bookings.ts:40-71`, written from `checkout/page.tsx` and `booking-panel.tsx` | **Merged** local bookings with `GET /classes/bookings/me`; local ids not present in the server list were prepended |

Same pattern as the wallet layer but weaker: it *merged* rather than
*overrode*, and the endpoint it complemented returns real rows. Because a
confirmed booking already comes back from `/classes/bookings/me`, the local copy
was redundant, so it was deleted together with the dashboard rewrite below
rather than fixed twice on the same screen.

---

## 10. Phase 1C — learner dashboard (S2) reads the live API

`/{locale}/bookings` was a server component rendering `MockLearnerDashboardGateway`
(a 5-booking fixture), and its client shell patched the list from `localStorage`
and fabricated transitions. Both are gone.

### 10.1 New gateway

`apps/web/src/lib/dashboard/http-gateway.ts` — `HttpLearnerDashboardGateway`
composes endpoints that already exist:

| Snapshot field | Source | Kind |
|---|---|---|
| `bookings[]` | `GET /classes/bookings/me` (`learnerBookingItemSchema`) | real |
| `metrics.upcomingCount` | same response, `totalUpcomingCount` | real (server-exact) |
| `metrics.pendingReviewCount` | same response, `ratingEligible && !hasRated` | real |
| `wallet.{available,held}` | `GET /wallet/balance` | real |
| `metrics.escrowHeldCredits` | wallet `pendingCredits` | real |
| `metrics.nextSessionLabel`, `escrowHeldClassCount`, `totalCompletedHours` | derived from the two payloads | **derived** (marked in code) |
| `calendar[]` | derived from booking `startsAt` | **derived** |
| `autoReleaseCountdownSeconds`, `receiptId` | derived from `expiresAt` / booking id | **derived** |

No new endpoint was added. The presentation mapping lives in
`lib/dashboard/api-my-bookings.ts` (`mapContractBookingToView`,
`toPresentationState`) so the shape conversion has one home.

### 10.2 The shell no longer invents state

`DashboardShell` used to apply a fabricated transition (`state: 'completed'`, a
review body, a receipt id) and write it to `localStorage` without the server
confirming. Now `confirm` / `no-show` / `cancel` call the real routes
(`POST /classes/bookings/:id/confirm`, `/no-show`, `/classes/:id/cancel`) and
refetch; when a review is supplied it also posts `POST /classes/bookings/:id/rating`.
A failure surfaces an inline `role="alert"` instead of a fake success.

The page is now pure chrome: metrics, list, calendar/wallet sidebar and the
loading / signed-out / error states are all owned by the shell, so nothing is
rendered on the server from fixtures.

### 10.3 Deleted as superseded

`lib/dashboard/mock-gateway.ts`, `lib/dashboard/mock-data.ts` and
`mock-gateway.test.ts` (dashboard-local) — nothing in production imported them
after the rewrite. The equivalent coverage is now behavioural, in
`DashboardShell.test.tsx` (live render, signed-out prompt, error state) and
`http-gateway.test.ts` (two-endpoint composition, auth error).

### 10.4 Known gap left open

`lib/marketplace/http-gateway.ts` still imports `DEFAULT_QUERY` from
`marketplace/mock-gateway.ts`, so that mock is still in the production import
graph. Moving the constant to a neutral module is a Phase 1F cleanup, not 1C.

---

## 9. Merge verification note

Resolving the two marketplace conflicts produced a clean working tree, but the
first merge commit captured a **stale index**: `HEAD` still contained a stray
`<<<<<<< HEAD` line in `MarketplaceClient.tsx` and `ClassDetailContent.tsx`.
Typecheck on the working tree passed, so it looked green while the commit itself
was broken. It was found by checking the marker count in `HEAD` directly rather
than in the files on disk, and fixed by staging the two resolved files and
amending.

Lesson for Phase 5: verify markers against `git show HEAD:<file>`, not the
working copy — a conflict marker left in a commit breaks the build for everyone
who pulls.

---

## 9.1 Demo disclosure — what to say honestly

These are the claims a reviewer or examiner can check, and the ones that must
not be overstated. Each is verified against the code at `ebc6fec`
(`pnpm verify` green).

**True and demonstrable**

| Claim | Evidence |
|---|---|
| Both clients are API-backed | web `lib/*/http-gateway.ts`, mobile `src/infrastructure/http/`; mock gateways are a mobile-only fallback |
| Money is integer VND, 1 credit = 1,000 VND, 10% fee | `DEFAULT_FEE_BPS = 1000`, `VND_PER_CREDIT = 1000`; `computePlatformFee`/`computeNetCredits` |
| Booking is hold-then-confirm | `POST /classes/:id/bookings` then `POST /classes/bookings/:bookingId/confirm` |
| Outbox + idempotent consumers | `apps/api/src/shared/messaging`, `processed_events` |
| Seven schemas, per-module credentials | ADR-014, `docker/postgres` init |

**Must be stated as a limitation, not shown as working**

| Limitation | Why it matters in the demo |
|---|---|
| Withdrawal has no endpoint | S11 renders an honest unavailable state; do not click it expecting a payout |
| `BookClassUseCase` does not check verified-student eligibility | a non-verified account can still book if it has credits |
| Class completion commits before wallet settlement, does not check expiry, no permanent class-lock column | the `complete` action returns before the release is guaranteed |
| `averageRating`/`ratingsCount` are provisional | `mobile-classes.ts:176` marks them "rating table not yet implemented"; `/instructor` no longer shows them |
| Mobile falls back to fixtures without `EXPO_PUBLIC_API_BASE_URL` | the demo **must** set it, or the mobile app silently shows mock data |
| Gateway proxies HTTP/JSON, not RPC | do not describe the backend as microservices |
| Generated diagram PNG/SVG for the corrected views are not re-rendered | re-run plantuml before the demo; sources are authoritative |

**Cannot be honest if omitted:** demoing the mobile client without
`EXPO_PUBLIC_API_BASE_URL` set shows fixtures that look like real data. Treat
that as a misconfiguration to fix before recording, not a fallback to rely on.

### 9.1.1 Review pass — fabricated publish values removed

A review of the branch against its own honesty rule found five values in the
publish workspace that were presented as fact with nothing behind them. They
are fixed at `ebc6fec`; the list is kept so the same class of defect is
recognisable, and so nobody re-adds a marketing number to make a screen look
fuller.

| Was shown | Why it was wrong | Now |
|---|---|---|
| Checklist: three ticks, "Valid"/"Ready", green "Eligible" badge | rendered unconditionally with no inputs — an ineligible draft got the same verdict as an eligible one | derived per row from the draft and the approved-skill list; header reads "Not yet eligible" when any row fails |
| Skill picker: "2 approved subjects" | fixed string; the teacher may have 0, 3 or 10 | plural over the real `skills.length` |
| Step 2: three roadmap bullets ("First 15m: Diagnostic pronunciation…") | fixed English-tutoring content shown as the teacher's syllabus; `POST /classes` stores one `description`, so nothing was ever submitted | bullets removed; panel explains it is an example and where the text actually goes |
| 1-on-1 card: "99.4% Completion Rate" | a statistic with no source; nothing computes one | removed |
| Group card: "Capacity 4 - 6"; room card: "End-to-End Encrypted" | the stepper allows 2–15; the self-hosted Jitsi setup has not been shown to be E2E-encrypted | capacity text matches the stepper; the encryption claim is dropped for "self-hosted Jitsi" |

Also fixed: the publish success panel was hardcoded Vietnamese, so it rendered
in Vietnamese on the English site — a vn/en mix on one screen.

---

## 10. Definition of done for Phase 0

- [x] Every screen mapped to a route in both clients
- [x] Every claim carries `file:line` evidence
- [x] Endpoint list verified against controllers, not docs
- [x] Reusable contracts identified
- [x] Defects recorded with severity and a decision needed
- [x] SRS screen inventory added (Phase 3C) — SRS Appendix D, plus §2.3.1 User Stories

---

## 11. Phase 1E — S13 rating and the publish surfaces (D4)

Commits: `0ffbc30` (money module + S13), `d8a1e19` (publish path),
`0b22179` (local-cache removal and instructor demo data).

### S13 — `/{locale}/bookings/[id]/review` is now real

The defect was worse than "never calls the rating API". `handleSubmit` awaited
the POST and then set success in a `finally`, so **a rejected rating still
rendered the green "verified" toast** and redirected. The rated stars arrived
from four per-criterion sliders that were averaged locally and discarded, and a
blank comment was replaced with a canned Vietnamese sentence.

Now: success is set only when the response is `ok`; a rejection shows the API's
own message inline and does not redirect. The comment is required, matching
`createRatingSchema`'s `comment.trim().min(1)`. The booking is located from
`GET /classes/bookings/me` by the route id, with explicit loading / signed-out /
not-found / not-eligible / already-rated states. The escrow split is derived
from the real price via the shared `computePlatformFee`/`computeNetCredits`, and
the balance comes from `GET /wallet/balance`. The four criteria are labelled a
private self-assessment — only the overall score is submitted, and the UI says
so. The fake downloadable files are replaced with an honest "not available yet"
line; no materials endpoint exists.

Removed with it: a hardcoded tutor (`Lan Anh`), avatar (`LA`), topic
(`Part 2 & 3 Education`), `1080p Clear Video`, `Duration: 60 minutes`, the
`150 Credit` balance, the `90 Credit`/`+81`/`9` settlement, a fabricated
`SS-VN-8821` booking id, a cross-matching block with no backing field, and a
`handleDownload` that only showed a toast.

### Money helpers moved out of `mock-data.ts`

`computePlatformFee`, `computeNetCredits`, `computeVndEstimate`, `clampPrice`,
`clampCapacity` and the validity predicates are the **real** BR-034 rules, but
they lived in a file named `mock-data.ts` next to demo fixtures. They are now in
`lib/teacher/money.ts`, so the publish preview and the post-session settlement
read one arithmetic source and cannot drift. The fixture half of
`mock-data.ts` and the whole `MockTeacherPublishGateway` are deleted.

### D4 — resolved: one publish path

`/{locale}/teach/classes/new` already called the real `POST /classes`, but then
**swallowed any failure** (`console.warn('...fallback to mock result')`) and
reported success from a mock gateway — so a rejected publish looked published.
It then **fabricated** `classroomCode = SS-<id tail>` and displayed it as
"Mã phòng học": `createClassSchema` has no such field, and the room is minted
later, per booking, by `POST /classes/bookings/{bookingId}/room-access`.

`PublishResult` no longer has a room-code field to fabricate. Success shows only
the class id the server returned.

`/{locale}/instructor` gets its class list from `GET /classes?teacherId=me` and
no longer layers a `skillswap_created_classes` cache on top, so the two screens
cannot disagree. The cache is also gone from the checkout fallback and from
`ClassDetailApiGateway`; an id the API cannot resolve is a not-found state.

Three more publish-surface fixes fell out of the same read:

1. **`new Date('T:00')` does not throw on V8** — it silently resolves to
   2000-01-01. The old `toStartsAtIso` guarded only against `NaN`, so a blank
   schedule would have published a class dated the year 2000. The date and time
   shapes are now validated first, and calendar rollover (`2026-02-31`,
   `24:30`) is rejected.
2. **"Save draft" is removed.** There is no draft endpoint — `POST /classes`
   publishes immediately — so the button could only pretend to persist.
3. **Verified skills come from `GET /profile-skills/me`.** The picker previously
   offered two fixture skills the server had never verified. That endpoint is
   auth-gated, so the workspace is now a client component with loading /
   signed-out / error / no-verified-skill states. Because
   `ProfileSkillView` carries no verifier name or approval date, `VerifiedSkill`
   drops both fields rather than inventing a person.

### Fabricated data removed from `/instructor`

None of these were computed from anything:

| Claim | Was |
|---|---|
| "35 buổi học", "100% hoàn thành đúng giờ" | literal |
| "4.9 / 5.0", "31 nhận xét", "98% hài lòng" | literal (schema marks rating fields **provisional**) |
| three class cards | hardcoded, with a fabricated id and a booking link |
| "Được duyệt bởi Thầy Hùng (8.5)" | a verifier not in the system |
| "Mã SV: VNU-2021-0988" | literal |
| name fallback `Lan Anh`, avatar `LA` | literals |
| `showClassReview` → "5/5 sao" | literal for any class |
| `copyShareLink` → `/lop-hoc/<code>` | a route that does not exist |

The tiles now show only server-reported values (available and pending credits)
and counts the class list itself yields; completed-session and satisfaction
metrics are omitted because they are not computable.

### Two more swallowed failures found in checkout

- `handleConfirmBooking` caught a failed `POST /classes/:id/bookings` in an inner
  `catch` and fell through to "simulated escrow", so **a booking that never
  happened opened the success modal**. Both the hold and the confirm must now
  succeed before the modal opens.
- the wallet page merged fabricated debit entries parsed from the dead
  `skillswap_user_bookings` key, defaulting the amount to `90` credits. The
  server ledger is now the only source.

### Left open (recorded, not faked)

- **Per-criterion ratings are not persisted** — the API accepts one `stars`.
- **`averageRating` / `ratingsCount`** are provisional per
  `packages/contracts/src/mobile-classes.ts:176` ("rating table not yet
  implemented"), so `/instructor` no longer shows them.
- **`ClassDetailApiGateway` still serves known demo ids** from
  `MockClassDetailGateway` before querying the API. Deliberate for the seeded
  demo, but it means a demo id shadows a real class with the same id.
- `BookClassUseCase` verified-student eligibility check (separate known gap).
- Marketplace `DEFAULT_QUERY` still imported from `marketplace/mock-gateway`
  (Phase 1F).

---

## 12. Runtime faults found while running both clients (2026-10-12)

Four faults were reported from a live dev run. Two were real defects, one was
correct behaviour, and one was a documented limitation surfacing. They are kept
here because the honest answer when presenting is not "everything was fine" but
"three of these were ours and one is by design."

Plan: [2026-10-12-client-runtime-faults-plan.md](./2026-10-12-client-runtime-faults-plan.md).

| Reported | Verdict | Cause | Fix |
|---|---|---|---|
| Hydration mismatch on `/{locale}/classes` (`/en/classes` vs `/vi/classes`) | **Real bug** | `navbar.tsx` read `window.location.pathname`, which is `undefined` during SSR, so the server always rendered the `vi` fallback while the client rendered `en`. Every page carrying the navbar mismatched on the `/en` tree. | locale now comes from `useLocale()`; regression test renders in both locales and asserts hrefs/labels follow the provider |
| `expo-notifications` red box on the mobile inbox | **Real defect** | `notifications.tsx` imported `expo-notifications` / `expo-device` at module scope. Both ship native modules absent in Expo Go from SDK 53, so the import alone crashed the screen — including the HTTP inbox that never needed push. | both imported lazily inside `enablePush`; the inbox renders in Expo Go, push still works on a development build |
| `api skills unauthorized` | **Not a bug** | `SkillsController.list` rejects `'anonymous'` (`skills.controller.ts:33`). The request carried no identity. | none |
| `auth/me 500` | **Real bug** | `AuthController.me` was the one `me`-style handler without the `'anonymous'` guard. `GetMeUseCase` passed the literal `'anonymous'` into `accounts.id` (a `uuid` column); Postgres raised `invalid input syntax for type uuid`, an unmapped error, so `DomainErrorFilter` returned 500 instead of 401. | controller rejects anonymous with 401, matching `NotificationsController` / `SkillsController` / `MyBookingsController` / `ClassListController`; regression test asserts 401 and that the use case is never called |
| Mobile "Cần cấu hình Gateway" panel | **By design (D5)** | `EXPO_PUBLIC_API_BASE_URL` is unset, so `httpApiEnabled()` is false and mobile falls back to fixtures. | none — already disclosed in §9.1 |

Both regression tests were demonstrated failing against the pre-fix code before
being kept.

### 12.1 Follow-up hole (not fixed here)

`auth/me` was not the only handler feeding `'anonymous'` into a uuid lookup.
These are guarded inconsistently and can produce the same 500:

- `wallet-ledger` — `GET /wallet/balance`, `GET /wallet/history`
  (`wallet.controller.ts:110,123` → `sql-wallet-reader.ts`, `sql-wallet-repository.ts`
  filter on `"owner_id"`).
- `student-verification` — `GET /student-verifications/me`
  (`student-verification.controller.ts:136`).
- `skill-verification` — the `skill-evidence` reads
  (`skill-evidence.controller.ts:51,76,104`).

Left untouched to keep the demo-freeze change narrow. The durable fix is a
shared `requireUserId(request)` helper replacing the copy-pasted guard; that is
deliberately a separate change.


