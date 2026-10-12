# Plan — Uniform response envelope + list controls (filter / sort / pagination / search)

Status: **Approved** — implementing phase by phase (one commit per phase)
Owner: (agent) · Created: 2026-10-11 · Updated: 2026-10-11
Related: `ARCHITECTURE.md` §4, `docs/plans/SkillSwap-SRS.md`, ADR-008 (gateway), ADR-012 (CQRS),
ADR-014 (TypeORM), ADR-022 (wallet history).

## 1. Problem

An audit of every GET endpoint (16 total; see §2) found:

- **No uniform response format.** Success returns a bare payload; errors return `apiErrorSchema`
  (`{statusCode,message,error}`) from `DomainErrorFilter`. There is no `{success,message,code,data}`.
- **Only one endpoint is paginated**: `GET /wallet/history` (keyset cursor). The other list
  endpoints return unbounded, unenveloped arrays.
- **No endpoint supports filter, sort or search**; there is exactly one `@Query()` in the repo.

The one genuinely dangerous endpoint is `GET /api/verifiers/me/queue`: it selects *every* pending
evidence row platform-wide matching the verifier's expertise, `ORDER BY submitted_at ASC`, with **no
LIMIT** (`sql-skill-evidence-repository.ts:187-217`).

## 2. Endpoint classification (why each does / does not change)

### A. Collections — get the full list treatment
| Endpoint | Cardinality | Change |
|---|---|---|
| `GET /api/verifiers/me/queue` | **Unbounded** | paginate (keyset) + filter (`level`,`type`) + stable sort (`submittedAt`,`id`) + `q` |
| `GET /api/profile-skills/me` | Bounded by catalogue (tens) | envelope only + optional `q`/`sort`; **no** pagination (document the bound) |
| `GET /api/wallet/history` | Unbounded | already keyset-paginated → **envelope + `total`** only |
| `GET /api/skill-evidence/:id/history` | Bounded per profile-skill | envelope only; complete-by-design audit (no pagination) |

### B. Singletons — envelope only, no list features
`GET /api/auth/me`, `GET /api/wallet/balance`, `GET /api/student-verifications/me`, and the 7
`GET /api/<module>/status` (schedule, wallet-ledger, skill-verification, student-verification,
account-profile, live-class, admin-operation).

The 7 `*/status` endpoints are **domain reads** (per-module state machine, `module_status WHERE
id = 1`) and DO get the envelope like every other domain GET.

### C. Excluded from the envelope (raw — infra/monitoring)
`GET /health` on **both** the gateway (`apps/gateway/src/health/health.controller.ts`) and the api
(`apps/api/src/bootstrap/health.controller.ts`).

Rationale for §2B: all are PK/owner lookups, so filter/sort/pagination/search are meaningless for a
single row.

## 3. Binding decisions

### 3.1 Envelope shape (every domain JSON response)
Success:
```jsonc
{
  "success": true,
  "code": "WALLET_HISTORY_OK",          // stable, machine-branchable (SCREAMING_SNAKE)
  "message": "Wallet history loaded",   // human-readable; NEVER branch on this
  "data": { /* payload */ },
  "errors": []
}
```
Failure:
```jsonc
{
  "success": false,
  "code": "ReasonRequiredError",        // stable code; the top-level code summarises the failure
  "message": "A rejection requires a reason",
  "data": null,
  "errors": [ { "code": "ReasonRequiredError", "message": "A rejection requires a reason" } ]
}
```
Rules:
- `data` is **always present** (`null` on error); `errors` is **always present** (empty on success).
- `success` + `code` are the machine surface; `message` is for humans (i18n-safe to ignore).
- HTTP status still carries the real semantics (200/201/4xx/5xx) — additive, not "200 for everything".
- `code` on success is a per-operation constant (`@ResponseCode`), default `"OK"`.
- `code` on failure = the domain error class name (see §3.2) or a Nest/pipe-derived code.

### 3.2 Error code mapping (the 66 existing domain errors)
`DomainErrorFilter.NAME_TO_STATUS` currently holds **66** domain error → status mappings
(`domain-error.filter.ts:17-92`):
400×20, 403×15, 404×8, 409×20, 401×3, and 413/415/503/500 ×1 each.
These class names **become `errors[].code`** (unchanged strings). Plus non-domain sources:
- Nest `HttpException` (e.g. `UnauthorizedException`) → code from the exception, default `HTTP_<status>`.
- `ZodValidationPipe` 400 → code `VALIDATION_FAILED`, one `errors[]` entry per field issue.
- Unknown/unhandled → 500, code `INTERNAL_ERROR`, message `Internal server error`.

### 3.3 Collection envelope + pagination shape
`data` for a list:
```jsonc
{
  "items": [ /* … */ ],
  "page": {
    "limit": 20,          // applied page size (1–100, default 20)
    "nextCursor": "eyJ…", // opaque base64 keyset cursor; null on the last page
    "total": 137          // total matching the filters (count ignores limit/cursor)
  }
}
```
- `total` is **always computed** — a `COUNT(*)` over the same filtered `WHERE` (filters applied,
  `limit`/`cursor` excluded) run in **the same transaction** as the page query.
- Page + count run via **`Promise.all`** inside one `source.transaction(...)` so the snapshot is
  coincident (documented as approximate under concurrent writes).
- Unpaginated collections (`/profile-skills/me`, `/skill-evidence/:id/history`) emit `"page": null`.

### 3.4 Query conventions (all optional)
- `limit` — int 1–100, default 20.
- `cursor` — opaque; invalid cursor → `400` code `INVALID_CURSOR`.
- `sort` — `<field>` (asc) or `-<field>` (desc); whitelist per endpoint; invalid → `400`
  code `INVALID_SORT`.
- `q` — free-text search; trimmed, min length 1.
- Endpoint filters — e.g. `level` (`beginner|intermediate|advanced|expert`), `type`
  (`certificate|verifier_assessment`).
- `total` — computed unless explicitly disabled (not offered at MVP).

### 3.5 Where it lives
- `packages/contracts/src/envelope.ts` + `pagination.ts`: Zod schemas + TS types shared by
  api/gateway/web/mobile.
- `apps/api/src/shared/http/response-envelope.interceptor.ts` + `@ResponseCode`/`@ResponseMessage`
  decorators.
- Extend `apps/api/src/shared/http/domain-error.filter.ts`.
- `apps/api/src/shared/http/keyset-cursor.ts`: generic base64 keyset cursor encode/decode.
- Gateway proxies verbatim (ADR-008) → **no change** except its own `/health` stays raw.
- Tests live beside each file (`*.spec.ts`); Nest: unit-test interceptor/filter/cursor directly.

### 3.6 Breaking change + docs
The envelope changes every response body. `apps/web/src/lib/api-client.ts` and `docs/api/*` must be
updated in the same series. Deliberate, spec-level decision recorded in the SRS.

### 3.7 Requirement IDs (docs-first)
- `NFR-013` — every domain JSON response uses the uniform `{success,code,message,data,errors}` envelope.
- `NFR-014` — every collection read is bounded (`limit` ≤ 100) and returns `page` metadata.
Add to `docs/plans/SkillSwap-SRS.md` in **Phase 0** before any code. No new ADR (implements existing
ADR-008/012 + NFR-011).

## 4. Phases (each phase = one commit; `pnpm verify` green at each)

### Phase 0 — Docs: requirements + conventions
Deliverables:
- `docs/plans/SkillSwap-SRS.md`: add `NFR-013`, `NFR-014` rows.
- `docs/api/RESPONSE-CONVENTIONS.md` (new): the envelope, error codes, pagination, query params.
- `docs/api/FRONTEND-API-GUIDE.md`: update to the new success + error shapes.
Commit: `docs(api): define uniform response envelope and list query conventions`

### Phase 1 — Shared envelope (contracts + api), no endpoint behaviour change yet
Deliverables:
- `packages/contracts/src/envelope.ts`: `apiEnvelopeSchema`, `apiErrorItemSchema`, `paginationSchema`,
  `pagedSchema(itemSchema)` factory + inferred types; `envelope.ts` unit spec.
- Export both from `packages/contracts/src/index.ts`.
- `apps/api/src/shared/http/response-envelope.interceptor.ts`: wraps handler results into the
  success envelope; reads the operation code/message from reflect metadata (defaults `OK`/`OK`).
  Skip wrapping for `/health` (via a `@RawResponse()` decorator or path check).
- `apps/api/src/shared/http/response-code.decorator.ts`: `@ResponseCode('...')`, `@ResponseMessage('...')`,
  `@RawResponse()`.
- Extend `DomainErrorFilter` to emit the failure envelope (keep status codes; add codes; map pipe
  validation to `VALIDATION_FAILED` with per-field `errors[]`). Update `domain-error.filter.spec.ts`.
- Register the interceptor globally (`APP_INTERCEPTOR`) in `app.module.ts`; keep the existing
  `APP_FILTER`.
- Tests: interceptor spec, decorator/metadata spec, filter spec (domain error, HttpException,
  validation, unknown).
Commit: `feat(api): add uniform success/error response envelope`

### Phase 2 — Keyset primitive + retrofit `/wallet/history`
Deliverables:
- `apps/api/src/shared/http/keyset-cursor.ts` (+ spec): `encodeCursor(parts)`, `decodeCursor`,
  `toPage(rows, limit)` peek-ahead helper. Generalise the logic currently inline in
  `sql-wallet-reader.ts:36-82`.
- `GET /wallet/history`: return the collection envelope; add `total` via a same-transaction
  `COUNT(*)`. Keep the existing `ORDER BY created_at DESC, id DESC`.
- `WalletReader`/`sql-wallet-reader.ts`: add a `count` method; run page + count with `Promise.all`
  inside one transaction.
- Update `wallet.controller.ts` Swagger (`WalletHistoryPageDto` → paged envelope), `packages/contracts`
  wallet history page type, and `sql-wallet-reader.spec.ts` / controller tests.
Commit: `refactor(wallet-ledger): envelope wallet history with total`

### Phase 3 — `/verifiers/me/queue` (the critical endpoint)
Deliverables:
- Contracts: `verifierQueueQuerySchema` (`limit`, `cursor`, `level`, `type`, `sort`, `q`) and
  `verifierQueuePageSchema` (paged).
- `apps/api/src/modules/skill-verification/internal/application/port/out/skill-evidence-repository.ts`:
  replace `listPendingForExpertise(expertise)` with `listPendingForExpertise(request)` where request
  carries `{ expertise, limit, cursor, level, type, sort, q }` and returns `{ items, total, hasMore }`.
- `sql-skill-evidence-repository.ts`: bounded SQL —
  `WHERE e.status='pending' AND s.id = ANY($1) [AND e.requested_level = $..] [AND e.evidence_type=$..]
  [AND s.name ILIKE $..] AND (e.submitted_at, e.id) > ($cursor) ORDER BY <sort> LIMIT $limit+1`,
  plus `COUNT(*)` with the same filters, all in one transaction via `Promise.all`.
- `list-verifier-queue.query.ts` + port-in: plumb the new shape.
- `verifier.controller.ts`: add `@Query()`, `@ResponseCode`, paged Swagger.
- **Index** migration (skill-verification schema): supporting index on
  `skill_evidence(status, submitted_at, id)` (and `requested_level`/`evidence_type` if used in filters)
  so the count is index-only. New migration under the module's migrations folder.
- Tests: repository spec (filters, cursor, total, sort), query-handler spec, controller spec.
Commit: `feat(skill-verification): paginate, filter and sort the verifier queue`

### Phase 4 — `/profile-skills/me` and `/skill-evidence/:id/history`
Deliverables:
- `/profile-skills/me`: envelope + optional `q` (skill name, ILIKE) + `sort` (`category`|`name`|
  `-approvedLevel`); `page: null`; Swagger documents the catalogue bound. Update repository
  `listByAccount` to accept the filter/sort, and its spec.
- `/skill-evidence/:id/history`: envelope only; Swagger documents audit completeness (no pagination).
- Two commits (one per endpoint):
  `feat(skill-verification): search and sort my profile skills`
  `feat(skill-verification): envelope the evidence history response`

### Phase 5 — Envelope the singletons
Deliverables:
- Add `@ResponseCode`/`@ResponseMessage` to: `auth/me`, `wallet/balance`,
  `student-verifications/me`, and the 7 `*/status` reads. Wrapping itself is automatic via the
  Phase-1 interceptor.
- Leave both `/health` raw (`@RawResponse()`).
- Update each controller's Swagger response type to the envelope.
Commit: `feat(api): envelope single-resource GET responses`

### Phase 6 — Client + docs sync
Deliverables:
- `apps/web/src/lib/api-client.ts` (+ `status.ts`): unwrap `data`, branch on `success`/`code`,
  surface `errors[]`; keep `/health` raw.
- Regenerate `pnpm docs:api`; update `docs/api/*.md`; re-check `apps/web` vitest specs.
Commit: `feat(web): unwrap the response envelope in the API client`

## 5. Definition of done
- `pnpm verify` green (lint `--max-warnings=0`, build, typecheck, jest/vitest, `pnpm test:arch`).
- No cross-schema SQL; no float money; integer VND untouched.
- Every collection endpoint is bounded (`limit` ≤ 100) or documents why it is inherently bounded.
- Every paged endpoint runs page + count in one transaction (`Promise.all`) with a supporting index.
- `docs/api` regenerated; SRS IDs `NFR-013`/`NFR-014` referenced from the touching commits.

## 6. Resolved decisions
1. **`message` + `code`** — both present. `message` = human-readable; `code` = stable machine
   constant (e.g. `WALLET_HISTORY_OK`). Clients branch on `success` + `code`/`errors[].code`.
2. **Error body** — extend the existing global `DomainErrorFilter` (66 domain codes + Nest/pipe
   codes) to `{success:false, code, message, data:null, errors:[{code,message}]}`, keeping HTTP status.
3. **`total`** — always computed; `page.total` is a non-null integer; page + count run together in
   one transaction; each paged endpoint gets a supporting index (documented cost: one extra query
   per page).
4. **`/health`** — **not** enveloped (gateway + api), kept raw for infra.
5. **`*/status`** — enveloped (domain reads); only `/health` is excluded.
