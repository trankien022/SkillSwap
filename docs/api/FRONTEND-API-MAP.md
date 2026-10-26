# Frontend API map

Every gateway route the two clients call, where they call it, and what each
client does in its own code because the server does not (yet) do it there.

This file is **pinned by tests**, so it cannot drift silently:

| Client | Spec | What it checks |
|---|---|---|
| Web | `apps/web/src/lib/api-map.test.ts` | Every `callApi`/`callApiOk`/`fetch` route literal in `apps/web/src` is listed below; nothing listed is unused. |
| Mobile | `apps/mobile/src/infrastructure/http/api-evidence.spec.ts` | The telemetry allow-list covers every route the mobile gateways call. |

Adding a route to a client therefore fails CI until it is added to the list
in this file *and* to the client's pinned list.

Paths are relative to the gateway prefix `http://<gateway>:4000/api`. `:id`
stands for one path segment. See `RESTful-CONVENTIONS.md` for the rules those
paths follow and `FRONTEND-API-GUIDE.md` for how to call them.

## Routes

### Authentication and identity — `account-profile`

| Route | Method | Web | Mobile | Notes |
|---|---|---|---|---|
| `/auth/register` | POST | `lib/api-client.ts` (`register`) | `infrastructure/auth/client.ts` | Raw `fetch`, not `callApi`: it runs before a session exists. |
| `/auth/login` | POST | `lib/api-client.ts` (`login`) | `infrastructure/auth/client.ts` | Same; the two auth posts are branched on `mode`. |
| `/auth/refresh` | POST | `lib/api-client.ts` (`refreshSession`) | `infrastructure/auth/client.ts` | Single-flight on both clients. |
| `/auth/logout` | POST | `lib/api-client.ts` (`logout`) | `infrastructure/auth/client.ts` | |
| `/auth/me` | GET | `lib/api-client.ts`, `components/navbar.tsx`, `app/[locale]/{instructor,wallet,wallet/withdrawal}/page.tsx`, `components/verification/VerificationContent.tsx` | `infrastructure/auth/client.ts` | The web calls it freely; it is the cheapest way to re-read the role. |

### Classes and bookings — `live-class`

| Route | Method | Web | Mobile | Notes |
|---|---|---|---|---|
| `/classes` | GET | `lib/marketplace/http-gateway.ts`, `lib/teacher/http-gateway.ts` (publish list), `app/[locale]/instructor/page.tsx` (`?teacherId=me`) | `infrastructure/http/class-read-gateway.ts` | `q` is the search term (`keyword` is a deprecated alias). Page cap 100. |
| `/classes/:id` | GET | `lib/marketplace/api-class-detail.ts`, `lib/booking/http-gateway.ts`, `app/[locale]/instructor/page.tsx` | `infrastructure/http/class-read-gateway.ts` | Detail carries `skills` (server-joined); no follow-up catalog read. |
| `/classes/:id/bookings` | POST | `lib/booking/http-gateway.ts` | `infrastructure/http/booking-http-gateway.ts` | |
| `/classes/:id/cancel` | POST | `lib/dashboard/http-gateway.ts` | `infrastructure/http/teaching-gateway.ts` | |
| `/classes/:id/start` | POST | `app/[locale]/instructor/page.tsx` | `infrastructure/http/teaching-gateway.ts` | |
| `/classes/:id/complete` | POST | `app/[locale]/instructor/page.tsx` | `infrastructure/http/teaching-gateway.ts` | |
| `/classes/bookings/me` | GET | `lib/dashboard/http-gateway.ts`, `components/dashboard/PostSessionReviewContent.tsx` | `infrastructure/http/my-bookings-gateway.ts` | `limit=50`; the learner dashboard filters client-side (see below). |
| `/classes/bookings/:bookingId/confirm` | POST | `lib/booking/http-gateway.ts`, `lib/dashboard/http-gateway.ts` | `infrastructure/http/booking-http-gateway.ts` | |
| `/classes/bookings/:bookingId/rating` | POST | `lib/dashboard/http-gateway.ts`, `components/dashboard/PostSessionReviewContent.tsx` | `infrastructure/http/rating-gateway.ts` | |
| `/classes/bookings/:bookingId/room-access` | POST | `lib/classroom/room-access-client.ts` | `infrastructure/http/room-access-gateway.ts` | |
| `/classes/bookings/:bookingId/no-show` | POST | `lib/dashboard/http-gateway.ts` | `infrastructure/http/booking-http-gateway.ts` | |

### Skill catalogue and evidence — `skill-verification`

| Route | Method | Web | Mobile | Notes |
|---|---|---|---|---|
| `/skills` | GET | `lib/marketplace/http-gateway.ts`, `lib/skills/http-gateway.ts` | `infrastructure/http/class-read-gateway.ts` | `?limit=100`; both clients hold the whole catalogue in memory for pickers. |
| `/profile-skills/me` | GET, PUT | `lib/skills/http-gateway.ts`, `lib/teacher/http-gateway.ts`, `app/[locale]/instructor/page.tsx` | `infrastructure/http/teaching-gateway.ts` | Bounded collection, cursorless: returns every skill. |
| `/skill-evidence` | POST, GET | `lib/skills/http-gateway.ts` | `infrastructure/http/skill-evidence-gateway.ts` | |
| `/skill-evidence/:id/history` | GET | `lib/skills/http-gateway.ts` | `infrastructure/http/skill-evidence-gateway.ts` | |
| `/skill-evidence/:id/claim` | POST | `lib/verification/http-gateway.ts` | `infrastructure/http/verifier-gateway.ts` | Verifier-only. |
| `/skill-evidence/:id/decision` | POST | `lib/verification/http-gateway.ts` | `infrastructure/http/verifier-gateway.ts` | Verifier-only. |
| `/verifiers/me/queue` | GET | `lib/verification/http-gateway.ts` | `infrastructure/http/verifier-gateway.ts` | Cursor-paged. |
| `/verifiers/:accountId/status` | POST | `lib/verification/http-gateway.ts` | — (admin-only, web only) | Admin-only. |
| `/verifiers/admin/queue` | GET | `lib/verification/http-gateway.ts` | — (admin-only, web only) | Admin-only. |

### Student verification — `student-verification`

| Route | Method | Web | Mobile | Notes |
|---|---|---|---|---|
| `/student-verifications` | POST, GET | `components/verification/VerificationContent.tsx` (submit), `lib/verification/http-gateway.ts` (admin list) | `infrastructure/http/student-verification-gateway.ts` | |
| `/student-verifications/me` | GET | `components/verification/VerificationContent.tsx` | `infrastructure/http/student-verification-gateway.ts` | |
| `/student-verifications/documents` | POST | `components/verification/VerificationContent.tsx` | `infrastructure/http/student-verification-gateway.ts` | Presigned upload. |
| `/student-verifications/:id/decision` | POST | `lib/verification/http-gateway.ts` | `infrastructure/http/student-verification-gateway.ts` | Admin-only. |
| `/student-verifications/:id/revocation` | POST | `lib/verification/http-gateway.ts` | `infrastructure/http/student-verification-gateway.ts` | Admin-only. |

### Wallet — `wallet-ledger`

| Route | Method | Web | Mobile | Notes |
|---|---|---|---|---|
| `/wallet/balance` | GET | `components/navbar.tsx`, `lib/booking/gate.ts`, `lib/dashboard/http-gateway.ts`, `components/payment/PaymentResultContent.tsx`, `app/[locale]/{instructor,wallet,wallet/withdrawal,classes/[id]/checkout}/page.tsx` | `infrastructure/http/booking-http-gateway.ts` | Read on many screens; the hook re-reads after checkout. |
| `/wallet/history` | GET | `app/[locale]/wallet/page.tsx` | `infrastructure/http/*` (wallet screens) | Cursor-paged. |
| `/wallet/top-ups` | POST | `app/[locale]/{wallet,classes/[id]/checkout}/page.tsx` | — (web checkout only) | Creates the SePay intent. |
| `/wallet/top-ups/:id` | GET | `app/[locale]/{wallet,classes/[id]/checkout}/page.tsx`, `components/payment/PaymentResultContent.tsx` | `infrastructure/http/*` | Polled until terminal. |
| `/wallet/top-ups/by-provider-ref/:providerRef` | GET | `components/payment/PaymentResultContent.tsx` | `infrastructure/http/*` | The handle SePay's redirect actually carries. |

### Admin operations — `admin-operation`

| Route | Method | Web | Mobile | Notes |
|---|---|---|---|---|
| `/admin-operation/dashboard` | GET | `lib/verification/http-gateway.ts` | — | Counts only; links on to `/audit-log`. Answers on `/operations/dashboard` too (ADR-037). |
| `/audit-log` | GET | `lib/verification/http-gateway.ts` | — | Admin-only, cursor-paged, filterable. |

### Operations (FR-015 / OQ-015 / ADR-037)

| Route | Method | Web | Mobile | Notes |
|---|---|---|---|---|
| `/operations/accounts` | GET | `lib/verification/http-gateway.ts` | — | Admin-only. `status` is a one-value enum (`suspended`); `?status=active` is a 400, not an empty page. |
| `/operations/accounts/:accountId/suspension` | POST | `lib/verification/http-gateway.ts` | — | Reason **required**; 400 when blank. Audited as `account.status.changed`. |
| `/operations/accounts/:accountId/reinstatement` | POST | `lib/verification/http-gateway.ts` | — | No body: a reason on a release is rejected, not dropped. |

### Notifications

| Route | Method | Web | Mobile | Notes |
|---|---|---|---|---|
| `/notifications` | GET | `lib/notifications/api-notifications.ts` | `infrastructure/http/notification-gateway.ts` | Cursor-paged. |
| `/notification-devices` | POST | — (mobile only) | `infrastructure/push/notification-device-lifecycle.ts` | Registers an Expo push token. |
| `/notification-devices/:id` | DELETE | — (mobile only) | `infrastructure/push/notification-device-lifecycle.ts` | Answers `204 No Content`. |

### Health

| Route | Method | Web | Mobile | Notes |
|---|---|---|---|---|
| `/health` | GET | `app/[locale]/status/page.tsx` | — | Not part of the business surface. Outside the envelope. |

## Client-side compensation

The point of the conventions is that the server does the work. Where a client
still filters, sorts or joins on its own, it is either a documented
convention exception or a known gap. Both are listed so they are visible.

### Documented convention exceptions

These are deliberate, recorded in
`docs/plans/2026-10-19-restful-conventions-alignment-plan.md`:

- **No `/api/v1` segment.** The gateway serves `/api/...` and clients are
  versioned in lock-step. A version segment buys nothing while both clients
  ship with the API.
- **Booking actions are sub-resources of a booking**, not of a class:
  `/classes/bookings/:bookingId/{confirm,rating,no-show,room-access}`. This
  reads oddly next to `/classes/:id/bookings` but is stable and already
  published; the mobile telemetry explicitly refuses to template a booking id
  as a class id.
- **Action endpoints are `POST /<resource>/:id/<verb>`** rather than a
  `PATCH` of a status field (`cancel`, `start`, `complete`, `claim`,
  `decision`, `revocation`). Each verb has its own preconditions and its own
  domain error; folding them into a status write would move that logic into
  the client.
- **Cursor-only pagination.** No `page`/`perPage` for cursor-paged collections;
  bounded collections (skills, profile skills) return `page: null`.

### Remaining client-side work

| Client | Where | What it does | Why |
|---|---|---|---|
| Web | `lib/marketplace/http-gateway.ts` → `applyClientFilters` | Filters the fetched class grid by category, format, min rating, price band and time window after the request | `GET /classes` has no such filter params yet. Fixing it means new optional query params on the live-class read side. |
| Web | `lib/marketplace/http-gateway.ts` → `applyClientFilters` | Re-applies the keyword filter over `skillName` + `teacherName` | The server already filters on `q`; the extra pass narrows to the two fields the grid shows. Harmless double work, but it is the one filter that is *not* a missing server capability. |
| Web | `lib/marketplace/http-gateway.ts` | Sorts the fetched items client-side | `GET /classes` accepts no `sort` for the marketplace ordering. |
| Web | `app/[locale]/wallet/page.tsx` | Filters `/wallet/history` by `direction` / `type` (`all`, `deposit`, `pay`, `escrow`) | `GET /wallet/history` returns one ledger stream; a `direction`/`type` filter would move this to the server. |
| Web | `lib/verification/http-gateway.ts` | Passes filters straight through as query params (`buildQuery`) | This is *not* compensation: the admin lists already filter server-side. Listed to show the contrast. |
| Mobile | `infrastructure/http/class-read-gateway.ts` | Holds the `/skills?limit=100` response in memory for pickers | The catalogue is bounded and small; per-keystroke server search would be worse. |
| Mobile | `infrastructure/http/notification-gateway.ts` | Merges the unread count from the notifications page | The list envelope already carries it; no second read. |

## Checks before adding a route

1. Does it follow `RESTful-CONVENTIONS.md`? If it must break a rule, add the
   exception to the plan document, not just the code.
2. Add it to this table **and** to the client's pinned list
   (`WEB_ROUTES` in `api-map.test.ts`, `evidenceRoute` in `api-evidence.ts`).
3. Run `pnpm --filter @skillswap/web test -- api-map` and
   `pnpm --filter @skillswap/mobile test -- api-evidence`.
4. Regenerate the module page with `pnpm docs:api` so Swagger and this table
   agree.
