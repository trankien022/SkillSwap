# Response conventions — uniform envelope & list controls

Applies to **every domain endpoint** on `apps/api` (and therefore to everything the gateway proxies
under `/api/*`). Source of truth in code: `packages/contracts/src/envelope.ts` and
`apps/api/src/shared/http/response-envelope.interceptor.ts`.

Related: **NFR-013** (uniform envelope), **NFR-014** (bounded collections), ADR-008 (gateway),
ADR-012 (CQRS), ADR-022 (wallet history).

## 1. Envelope

Every domain JSON response uses the same five keys.

### Success

```json
{
  "success": true,
  "code": "WALLET_HISTORY_OK",
  "message": "Wallet history loaded",
  "data": { "items": [], "page": { "limit": 20, "nextCursor": null, "total": 0 } },
  "errors": []
}
```

### Failure

```json
{
  "success": false,
  "code": "ReasonRequiredError",
  "message": "A rejection requires a reason",
  "data": null,
  "errors": [
    { "code": "ReasonRequiredError", "message": "A rejection requires a reason" }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `success` | boolean | `true` on 2xx, `false` otherwise. |
| `code` | string | Stable, machine-readable (SCREAMING_SNAKE on success, error class name on failure). |
| `message` | string | Human-readable. **Never branch on this** — it may be localized. |
| `data` | object \| array \| null | The payload. Always present; `null` on error. |
| `errors` | array | Always present; `[]` on success. Each entry `{ code, message }`. |

**Rules**

- `data` and `errors` are **always present** (never omitted) so a client can write one unwrapper
  (`body.data`) and one error branch (`body.success === false`).
- The **HTTP status code still carries the real semantics** (200/201/400/401/403/404/409/413/415/503/500).
  The envelope is additive — this is **not** a "200 with `success:false`" API.
- Clients branch on `success` and `code` / `errors[].code`. Treat `message` as display-only.

### Exemptions

- `GET /health` on **both** the gateway (`:4000`) and the api (`:4001`) stays **raw** for
  load balancers / uptime monitors. It is not part of the domain envelope.

## 2. Error codes

`errors[].code` is one of:

1. A **domain error class name** (66 known — e.g. `ReasonRequiredError`, `InactiveVerifierError`,
   `OutOfExpertiseError`). See `NAME_TO_STATUS` in
   `apps/api/src/shared/http/domain-error.filter.ts`.
2. `VALIDATION_FAILED` — request validation failed (`ZodValidationPipe`); one `errors[]` entry per
   invalid field.
3. `HTTP_<status>` — a Nest `HttpException` with no domain mapping (e.g. `HTTP_401`).
4. `INTERNAL_ERROR` — unhandled failure (HTTP 500).

The top-level `code` mirrors `errors[0].code` (or the summary code when `errors` is empty).

Common status codes: `400` invalid body/query, `401` missing/expired token or bad credentials,
`403` forbidden, `404` not found, `409` conflict (duplicate, locked, illegal transition),
`413`/`415` document too large / unsupported type, `503` provider unavailable.

## 3. Collections & pagination

A collection response puts a **page** inside `data`:

```json
{
  "success": true,
  "code": "VERIFIER_QUEUE_OK",
  "message": "Verifier queue loaded",
  "data": {
    "items": [ /* … */ ],
    "page": { "limit": 20, "nextCursor": "eyJzdWJtaXR0ZWRBdCI6Ii4uLiJ9", "total": 137 }
  },
  "errors": []
}
```

| Field | Type | Notes |
|---|---|---|
| `items` | array | The page of results. |
| `page.limit` | integer | Applied page size (1–100, default 20). |
| `page.nextCursor` | string \| null | Opaque cursor. Pass it back as `?cursor=`. `null` on the last page. |
| `page.total` | integer | Total rows matching the **filters** (ignores `limit`/`cursor`). |

**Pagination is keyset (cursor) based**, not offset/page-number:

- `total` is always computed (a `COUNT(*)` over the same filtered `WHERE`).
- Page and count run in **one transaction** so the snapshot is coincident; under concurrent writes
  `total` is a documented approximation.
- `nextCursor` is opaque (base64). Never construct or parse it on the client.

Collections that are inherently bounded return `"page": null` instead of a `page` object
(e.g. `GET /api/profile-skills/me`, bounded by the skill catalogue).

## 4. Query parameters

All optional; each endpoint documents which it supports.

| Param | Meaning | Notes |
|---|---|---|
| `limit` | Page size | int 1–100, default 20. |
| `cursor` | Next-page cursor | Opaque; from the previous `page.nextCursor`. Invalid → `400 INVALID_CURSOR`. |
| `sort` | Sort field | `<field>` ascending, `-<field>` descending. Whitelist per endpoint. Invalid → `400 INVALID_SORT`. |
| `q` | Free-text search | Trimmed; min length 1. |
| *(filters)* | Endpoint-specific | e.g. `level`, `type`, `category`. |

Example:

```
GET /api/verifiers/me/queue?limit=20&level=advanced&type=certificate&sort=submittedAt&q=guitar
```

### Where each list endpoint stands

| Endpoint | Pagination | Filter | Sort | Search |
|---|---|---|---|---|
| `GET /api/verifiers/me/queue` | ✅ keyset + `total` | `level`, `type` | `submittedAt` (default `submittedAt` asc) | `q` (skill name) |
| `GET /api/verifiers/admin/queue` | ✅ keyset + `total` | `domain`, `status` | `submittedAt` (default asc) | `q` (skill name) |
| `GET /api/student-verifications` | ✅ keyset + `total` | `status` | `submittedAt` / `decidedAt` (default `submittedAt` asc) | `q` (school name) |
| `GET /api/audit-log` | ✅ keyset + `total` | `actorId`, `action`, `targetType`, `targetId`, `from`, `to` | `occurredAt` (default `-occurredAt`) | `q` (target id) |
| `GET /api/wallet/history` | ✅ keyset + `total` | — | fixed newest-first | — |
| `GET /api/profile-skills/me` | — (bounded; `page: null`) | — | `category` (default), `name`, `-approvedLevel` | `q` (skill name) |
| `GET /api/skill-evidence/:id/history` | — (audit complete by design) | — | fixed version-desc | — |

### Operations dashboard codes (FR-015, ADR-034)

These are the `code` values the admin operations surface returns on success. Every one is
`@Roles('admin')`; a non-administrator gets the standard `HTTP_403`.

| Endpoint | Success `code` |
|---|---|
| `GET /api/student-verifications` | `ADMIN_VERIFICATIONS_OK` |
| `GET /api/verifiers/admin/queue` | `ADMIN_VERIFIER_QUEUE_OK` |
| `GET /api/audit-log` | `AUDIT_LOG_OK` |
| `GET /api/admin-operation/dashboard` | `ADMIN_DASHBOARD_OK` |

## 5. Frontend usage

```ts
const res = await fetch(`${API}/api/wallet/history?limit=20`, { headers: auth });
const body = await res.json();

if (!body.success) {
  // branch on the stable code, show the human message
  if (body.errors.some((e) => e.code === 'HTTP_401')) await refreshSession();
  throw new ApiError(body.code, body.message, body.errors);
}

const { items, page } = body.data;
// page.nextCursor === null → no more pages
```
