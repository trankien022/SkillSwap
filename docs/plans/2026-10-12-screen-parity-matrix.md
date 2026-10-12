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
| S2 | Learner dashboard | `/{locale}/bookings` | `(tabs)/index.tsx` → `dashboard-view.tsx` | `GET /classes/bookings/me` + `GET /wallet/balance` | ❌ Mock | ✅ Real |
| S3 | Marketplace | `/{locale}/classes` | `(tabs)/explore.tsx` → `marketplace-view.tsx` | `GET /classes` + `GET /skills` | ❌ Mock | ✅ Real |
| S4 | Class detail | `/{locale}/classes/[id]` | `classes/[id].tsx` → `class-detail-view.tsx` | `GET /classes/{id}` | ❌ Mock | ✅ Real |
| S5 | Login | `/{locale}/auth` (`/login` redirects) | `(auth)/login.tsx` | `POST /auth/login` | ✅ Real | ✅ Real |
| S6 | Register | `/{locale}/auth` (`/register` redirects) | `(auth)/register.tsx` | `POST /auth/register` | ✅ Real | ✅ Real |
| S7 | Wallet | `/{locale}/wallet` | `(tabs)/wallet.tsx` | `GET /wallet/balance`, `GET /wallet/history` | ✅ Real | ✅ Real |
| S8 | Top-up / checkout | `/{locale}/classes/[id]/checkout` | `wallet-view.tsx` | `POST /wallet/top-ups`, `POST /classes/{id}/bookings` | ✅ Real | ✅ Real |
| S9 | Student verification | `/{locale}/verification` | `(features)/verification.tsx` | `GET/POST /student-verifications` | ✅ Real | ✅ Real |
| S10 | Skills / evidence | **missing** | `(features)/skills.tsx` | `GET /skills`, `GET /profile-skills/me`, `POST /skill-evidence` | ❌ Missing | ✅ Real |
| S11 | Withdrawal | `/{locale}/wallet/withdrawal` | `wallet-view.tsx` | `GET /wallet/balance` (submit has **no** endpoint) | ⚠️ Partial | ➖ not built |
| S12 | My classes / teaching | `/{locale}/instructor` | `(features)/teaching.tsx` | `POST /classes`, `PATCH /classes/{id}`, `POST /classes/{id}/complete` | ⚠️ Partial | ✅ Real |
| S13 | Post-class rating | `/{locale}/bookings/[id]/review` | `my-bookings-view.tsx` | `POST /classes/bookings/{id}/rating` | ❌ No call | ✅ Real |
| S14 | Jitsi classroom | `/{locale}/bookings/[id]/live` | `my-bookings-view.tsx` | `POST /classes/bookings/{id}/room-access` | ✅ Real | ✅ Real |
| S15 | Profile | Navbar only | `(tabs)/profile.tsx` | session | ⚠️ Partial | ✅ session |
| S16 | System status | `/{locale}/status` | — | `GET /health` | ✅ Real | ➖ |
| S17 | Notifications | `/{locale}/notifications` | `(features)/notifications.tsx` | `GET /notifications`, `POST /notification-devices` | ❌ Hardcoded | ✅ Real |

**Tally:** Web 8 real / 2 partial / 5 mock-or-missing. Mobile 12 real / 4 session-or-guard / 1 not built.

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
| 1A | S3, S4 | Highest visual divergence; contracts exist |
| 1B | S8 | Money path — but Web **already** uses the real booking endpoint, so this is smaller than planned. Real work is removing `MockBookingGateway` from `booking-panel.tsx:57` |
| 1C | S2 | Needs `GET /classes/bookings/me` + `/wallet/balance`; several dashboard fields have no API → derive |
| 1D | S17 | Replace hardcoded data; endpoint + schema both exist |
| 1E | S13, S12 | Rating endpoint exists; S12 must unify the two publish surfaces (D4) |
| 1F | D1, D2 | Delete or repoint dead code; consolidate auth clients |
| 1G | S10 | Add the missing Web skills screen, mirroring `(features)/skills.tsx` |

---

## 7. Definition of done for Phase 0

- [x] Every screen mapped to a route in both clients
- [x] Every claim carries `file:line` evidence
- [x] Endpoint list verified against controllers, not docs
- [x] Reusable contracts identified
- [x] Defects recorded with severity and a decision needed
- [ ] SRS screen inventory added (Phase 3C)
