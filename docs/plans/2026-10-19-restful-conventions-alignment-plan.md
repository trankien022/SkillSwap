# RESTful conventions alignment — phased plan

**Date:** 2026-10-19 · **Branch:** `feat/api-rest-conventions` · **Driver:** `docs/api/RESTful-CONVENTIONS.md`

## Why

`docs/api/RESTful-CONVENTIONS.md` sets the house rules for how this API should look on the wire.
The API was built incrementally (`ADR-016` … `ADR-034`) and each increment followed `RESPONSE-CONVENTIONS.md`
for the envelope, but nobody checked the whole surface against the REST conventions afterwards, and the
frontends grew their own assumptions about endpoints. This plan audits both sides, fixes the real defects,
deletes the routes that represent no business, and writes down the endpoint ↔ client map so the next
drift is visible instead of discovered at runtime.

## What the conventions actually require of us

These are the rules that apply to _this_ API. Where an existing decision already satisfies a rule, it is
recorded as satisfied rather than re-litigated.

| Rule (§) | Applies here? | Current state |
|---|---|---|
| §3.1 Resource-oriented nouns; action endpoints allowed where CRUD cannot express the operation (§10) | Yes | Mostly satisfied. Action verbs (`/cancel`, `/start`, `/complete`, `/confirm`, `/claim`, `/decision`) are state transitions on a resource and §10 explicitly permits them. |
| §3.2 Lowercase, hyphens, plural collections, path params for identity | Yes | Satisfied (`/student-verifications`, `/notification-devices`, `/profile-skills`, `/skill-evidence`). |
| §3.3 Versioning consistent and documented | Partial | **Deliberate exception.** The URL has no version segment; the gateway contract is additive-only today and both clients ship with the API. Documented in §"Exceptions" below; not changed in this plan. |
| §4 Method semantics; `GET` never mutates | Yes | Satisfied — every state change is `POST`/`PATCH`/`DELETE`. |
| §5.3 Query params descriptive, bounded, documented | Yes | **Gap.** Two search-param names (`keyword` vs `q`) for the same concept; `limit` bounds differ per endpoint; `/profile-skills/me` silently ignores an unknown `limit`. |
| §5.5 camelCase JSON, ISO-8601 dates | Yes | Satisfied. |
| §6.1 `201` on create, `204` on delete-without-body | Yes | **Gap.** `DELETE /notification-devices/:id` returns `200` with a body. |
| §6.2 Consistent response structure | Yes | Satisfied — `RESPONSE-CONVENTIONS.md` envelope (`{ success, code, message, data, errors }`), used uniformly. RFC 9457 is "a recommended standard", not mandatory; the envelope already carries stable `code` + structured `errors`. Kept as-is. |
| §6.3 Consistent collection format, cursor pagination allowed | Yes | Satisfied — keyset `{ items, page: { limit, nextCursor, total } }`. Kept. |
| §7 Status codes | Yes | Mostly satisfied; the `204` gap above plus booking rejections collapsing to a single `code`. |
| §8 Consistent error schema, **stable machine-readable codes** | Yes | **Gap.** `BookingNotAllowedError` and `ClassNotFoundError` report the _class name_ as `code` instead of the stable reason the clients branch on. |
| §9 Sorting allowlists, max page sizes, documented defaults | Yes | Mostly satisfied; max page size documented as 100 but classes/bookings/notifications cap at 50. |
| §11 AuthN/AuthZ server-side; no reliance on FE | Yes | Satisfied — gateway injects identity, every controller guards. |
| §15 Each endpoint: method, URL, auth, params, body, success/error schemas | Yes | **Gap.** Many controllers lack `@ApiBearerAuth`, response DTO descriptions, and documented error codes. |
| §16 Automated tests for the contract | Yes | **Gap.** No test pins the endpoint URLs the frontends call, so a rename breaks clients silently. |

## Priority table

| # | Defect | Rule | Severity | Where |
|---|---|---|---|---|
| 1 | `DELETE /notification-devices/:id` returns `200 {success:true}` instead of `204` | §6.1 | Medium | `account-profile/.../notification-devices.controller.ts` |
| 2 | Booking rejections all report `code: "BookingNotAllowedError"` | §8 | **High** — web silently degrades every rejection to `class_not_bookable` | `shared/http/domain-error.filter.ts`, `live-class/.../booking.ts` |
| 3 | `ClassNotFoundError` reports `code: "ClassNotFoundError"` | §8 | Low | `domain-error.filter.ts` |
| 4 | Class detail is resolved on web by scanning `GET /classes?limit=50` before calling `GET /classes/:id` | §3.1, §10 | Medium — wrong class silently 404s past 50 rows; stale comment claims no detail route exists | `web/src/lib/marketplace/http-gateway.ts`, `ClassDetailContent.tsx` |
| 5 | Search param is `keyword` on classes/skills but `q` everywhere else | §5.3 | Low | `contracts/mobile-classes.ts`, `mobile-catalogue.ts`, `skill-evidence.ts`, admin query schemas |
| 6 | Page-size cap 50 vs documented 100 | §9 | Low | `contracts/mobile-classes.ts`, `mobile-my-bookings.ts`, `mobile-notifications.ts` |
| 7 | `/profile-skills/me` accepts and ignores an unknown `limit` (web sends `?limit=50`) | §5.3 | Low | `web/src/lib/teacher/http-gateway.ts` |
| 8 | 7 modules expose `/status` + `/status/advance` lifecycle probes in Swagger | §3.1 | Medium — no business capability; confuses the reference | `*/status.controller.ts`, `bootstrap/openapi.ts`, `scripts/generate-api-modules.mjs` |
| 9 | No documentation of which endpoint each frontend calls | §15, §16 | Medium | `docs/api/`, tests |
| 10 | Missing `@ApiBearerAuth` / response DTOs on several controllers | §15 | Low | `class-list`, `class-detail`, `my-bookings`, `ratings`, `skills`, `skill-evidence`, `notifications`, `notification-devices`, `status`, `student-verification` |

## Non-goals (and why)

- **URL restructuring.** Moving `/classes/bookings/me` → `/classes/:id/bookings/me` or
  `/classes/bookings/:bookingId/confirm` → `/classes/:id/bookings/:bookingId/confirm` is more RESTful
  under §10, but it is a breaking change for both shipped clients for no behavioural gain. Recorded as
  an exception instead.
- **Envelope replacement.** Changing to bare/`application/problem+json` bodies would break both clients
  and contradict `RESPONSE-CONVENTIONS.md`. The existing envelope satisfies §6.2 and §8.
- **Offset pagination.** §6.3 and §9 both allow cursors; keyset is already implemented and correct.
- **Dropping the DB `module_status` machinery.** Only the HTTP surface goes away. `liv-class` and
  `wallet-ledger` domain transitions, the `module_status` table, the SQL adapters and
  `STATUS_CHANGED_EVENT` remain because the domain still models module state.

## Phases

Each phase is one commit and leaves `pnpm verify` green.

### Phase 0 — Land the conventions and this plan (docs)

- Commit `docs/api/RESTful-CONVENTIONS.md` (currently untracked) and this plan.
- Regenerate `docs/api/` to pick up the stale `admin-operation` description carried over from #93.

### Phase 1 — Remove the module lifecycle probes

The seven `/status` + `/status/advance` routes describe no business capability; they were scaffolding
from `scripts/generate-api-modules.mjs`.

- Delete all 7 `status.controller.ts`, their `dto/status.dto.ts`, and the `advance-status.*` /
  `get-module-status.*` use-case + handler + port + DTO files that exist only to serve them.
- Remove `StatusController` from each module's `controllers`, and the `ADVANCE_STATUS`,
  `GET_MODULE_STATUS`, `STATUS_READER`, `STATUS_WRITER` providers from modules where nothing else uses
  them. Keep a provider if a domain service consumes it.
- Delete the `dto/status.dto.ts`-only contract exports if any.
- Update `scripts/generate-api-modules.mjs` so new modules stop emitting status routes.
- Update `API_TAGS` in `bootstrap/openapi.ts` and `MODULE_NOTES` in `scripts/gen-api-docs.cjs`; regenerate
  `docs/api/`.
- **Do not touch**: the `module_status` table/migrations, `*_domain/module-status.ts` transitions,
  `sql-module-status-*.ts` adapters, `module-status.spec.ts`, `STATUS_CHANGED_EVENT` (kept where a domain
  still consumes them).
- Tests: any spec asserting `/status` is deleted with the route; gateway specs that allow-list probe
  paths are updated.

### Phase 2 — Error codes and status codes (backend, §7 + §8)

- `BookingNotAllowedError`: report its `reason` as the envelope `code` (`class_full`, `duplicate_booking`,
  `self_booking`, `class_started`, `booking_window_closed`, `class_not_bookable`, `invalid_duration`).
  Implement in `DomainErrorFilter` by reading `exception.reason` for that class — not a new taxonomy.
- `ClassNotFoundError`: report `class_not_found`.
- `DELETE /notification-devices/:id`: `204 No Content`, empty body; mobile's `request()` already maps 204
  to `undefined`, so the mobile gateway stops parsing the old `{success:true}` body.
- Tests: filter unit tests for each booking reason; e2e assertion that a full class returns
  `409` + `code: "class_full"`.

### Phase 3 — Class detail and list conformance (backend + web, §3.1 + §10)

- Web detail stops scanning the list: `ClassDetailContent` calls `GET /classes/:id` once and maps it.
- To keep the detail page's skill name/category/level, extend `classDetailViewSchema` with an optional
  `skills: [{ id, name, category, levels }]` array resolved server-side (live-class may read the skill
  catalogue through its existing port — no cross-schema join). When the catalogue read fails, the field
  is omitted and the web keeps its honest "not provided" state.
- Remove the dead `findById` list-scan and its stale comment; keep `getCatalogue` for the list page.
- Tests: contract schema test for the new field; controller spec; web mapping test that a detail with
  skills renders name/category/level and one without renders null.

### Phase 4 — Query-parameter conformance (§5.3 + §9)

- Accept `q` as the canonical search parameter on classes and skills; keep `keyword` as a documented
  alias for one release, marked deprecated in OpenAPI. Contracts expose both, resolving `q ?? keyword`.
- Align page-size caps with the documented 100 (`classes`, `my-bookings`, `notifications`), or lower the
  documented maximum — pick one and make `RESPONSE-CONVENTIONS.md` agree with the schemas.
- `/profile-skills/me`: drop the misleading `?limit=50` from the web client (the endpoint is bounded).
- Tests: query schema tests for `q`/`keyword` precedence and the 100 cap.

### Phase 5 — Swagger completeness (§15)

- Add `@ApiBearerAuth('bearer')` to every authenticated controller that lacks it.
- Add `@ApiOkResponse({ type })`/`@ApiCreatedResponse` where the response DTO is currently untyped, and
  `@ApiResponse` for the documented error codes.
- Regenerate `docs/api/` and check the index no longer lists probe modules.

### Phase 6 — Frontend API map + contract pinning (§15 + §16)

- Write `docs/api/FRONTEND-API-MAP.md`: every endpoint, the web file that calls it, the mobile file that
  calls it, and any client-side filtering that compensates for a missing server capability.
- Pin the map with tests:
  - web: parse `callApi(...)` literals across `apps/web/src/lib/**` and assert they all match a known
    route list;
  - mobile: extend the `evidenceRoute` allow-list test so every gateway path is observed.
- Update `RESPONSE-CONVENTIONS.md` (search param, page caps) and `FRONTEND-API-GUIDE.md` where they drift.

## Exceptions (recorded, not fixed)

| Exception | Justification |
|---|---|
| No `/api/v1` segment (§3.3) | Additive-only contract; a version prefix would be new surface with no client to serve. Revisit at the first breaking change. |
| Action endpoints (`/cancel`, `/start`, `/complete`, `/confirm`) (§10) | Domain state transitions with guards; §10 permits them explicitly. |
| Flat booking paths (`/classes/bookings/me`) (§3.2 nesting) | Nested form would break two shipped clients. Documented in the frontend map. |
| Envelope instead of RFC 9457 problem+json (§8) | Existing, uniform, already carries stable codes; §8 recommends rather than requires it. |

## Verification

- `pnpm verify` (lint, build, typecheck, unit tests, `test:arch`) after every phase.
- `pnpm test:e2e` with local `postgres` + `rabbitmq` before opening the PR.
- `pnpm docs:api` regeneration is committed with Phase 1 and Phase 5.
