# 2026-10-14 - TASK-01 web verification plan (Phase 0 only)

## Scope and hard stop

This document records Phase 0 only.

- No contract edits
- No gateway edits
- No test edits
- No UI edits
- No implementation code
- No Phase 1 prep beyond documenting exact findings required by TASK-01

## Sources read

- `packages/contracts/src/index.ts`
- `packages/contracts/src/pagination.ts`
- `docs/api/skill-verification.md`
- `docs/api/student-verification.md`
- `apps/api/src/modules/student-verification/internal/adapter/in/web/student-verification.controller.ts`
- `C:\Users\ASUS\AppData\Local\Temp\Zalo Temp\ffa23b1f87c075e4d830afe9cb5fd11f~\tasks\TASK-01-web-verification-moderation.md`
- `tasks/taskbyrole/TASKS-INDEX.md`

## Availability note

`SkillSwap-WEB-FE-API-Mapping.md` is referenced by TASK-01 and `tasks/taskbyrole/TASKS-INDEX.md`, but the file is not present in the current workspace snapshot or the shared temp task bundle. This Phase 0 record therefore uses the accessible task file plus `docs/api/*`, `packages/contracts`, and the API controller as the factual source set.

---

## 1. Exact role schema from `packages/contracts`

Do not infer role values from route decorators alone. The exact contract source is:

| Item | Exact source |
|---|---|
| Schema name | `accountRoleSchema` |
| Consuming field name | `meResponseSchema.role` |
| Literal values | `'user' \| 'verifier' \| 'admin'` |

Notes from source:

- `accountRoleSchema = z.enum(['user', 'verifier', 'admin'])`
- `meResponseSchema` exposes `role: accountRoleSchema`
- `selfRegistrationRoleSchema` exists separately and is only `['user']`; it is not the runtime role gate for signed-in UI

Phase 1+ UI gating must therefore read the signed-in caller role from `meResponseSchema.role` and treat the allowed values as exactly `user`, `verifier`, and `admin`.

---

## 2. Verifier route decision

### Decision

Choose **Option A**: `/${locale}/verifier`

### Rationale

1. `/${locale}/verification` already exists as the learner-facing verification center and currently owns the student-verification flow.
2. The verifier queue is a distinct role-gated moderation surface (`@Roles('verifier')` in the API), not a general learner flow.
3. The API and contracts use the noun **verifier** consistently (`verifier`, `/verifiers/*`, `VerifierQueuePage`, `VerifierStatusChangeInput`), so the route name stays aligned with existing backend vocabulary.
4. Keeping the queue out of `/${locale}/verification` avoids mixing:
   - learner self-service verification submission/read
   - verifier-only queue/claim/decision moderation
5. TASK-01 already recommends `/[locale]/verifier`, and TASK-02 is expected to mirror the naming on mobile.

Result: the learner-facing route remains `/${locale}/verification`; the verifier moderation surface gets its own role-specific route at `/${locale}/verifier`.

---

## 3. Contract definitions to use as source of truth

Shapes below mirror `docs/api/skill-verification.md` and `docs/api/student-verification.md` exactly. No extra fields are defined here.

### 3.1 `VerifierQueuePage`

Source endpoint: `GET /api/verifiers/me/queue`

#### Top-level shape

| Field | Type | Required | Notes |
|---|---|---|---|
| `items` | object[] | yes | Queue items |
| `page` | object | yes | Page metadata |

#### `items[]` shape

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | min 1 chars |
| `profileSkillId` | string | yes | min 1 chars |
| `skillId` | string | yes | min 1 chars |
| `skillName` | string | yes | min 1 chars; nullable |
| `category` | string | yes | min 1 chars; nullable |
| `ownerId` | string | yes | min 1 chars; nullable |
| `version` | integer | yes | > 0 |
| `evidenceType` | enum | yes | `certificate` \| `verifier_assessment` |
| `documentRef` | string | yes | min 1 chars; nullable |
| `description` | string | yes | min 1 chars; nullable |
| `requestedLevel` | enum | yes | `beginner` \| `intermediate` \| `advanced` \| `expert` |
| `approvedLevel` | enum | yes | `beginner` \| `intermediate` \| `advanced` \| `expert`; nullable |
| `status` | enum | yes | `pending` \| `claimed` \| `approved` \| `rejected` \| `superseded` |
| `claimedBy` | string | yes | min 1 chars; nullable |
| `claimedAt` | string | yes | date-time; nullable |
| `reason` | string | yes | min 1 chars; nullable |
| `decidedAt` | string | yes | date-time; nullable |
| `submittedAt` | string | yes | date-time |

#### `page` shape

| Field | Type | Required | Notes |
|---|---|---|---|
| `limit` | integer | yes | >= 1; <= 100 |
| `nextCursor` | string | yes | min 1 chars; nullable |
| `total` | integer | yes | >= 0 |

### 3.2 `SkillEvidenceDecisionInput`

Source endpoint: `POST /api/skill-evidence/{id}/decision`

| Field | Type | Required | Notes |
|---|---|---|---|
| `decision` | enum | yes | `approve` \| `reject` |
| `approvedLevel` | enum | no | `beginner` \| `intermediate` \| `advanced` \| `expert` |
| `reason` | string | no | min 1 chars; max 500 chars |

### 3.3 `VerifierStatusChangeInput`

Source endpoint: `POST /api/verifiers/{accountId}/status`

| Field | Type | Required | Notes |
|---|---|---|---|
| `status` | enum | yes | `active` \| `suspended` \| `revoked` |

### 3.4 `StudentVerificationDecisionInput`

Source endpoint: `POST /api/student-verifications/{id}/decision`

`docs/api/student-verification.md` names the request DTO `VerificationDecisionDto`; this plan uses the task-required contract label `StudentVerificationDecisionInput` for the same exact body shape.

| Field | Type | Required | Notes |
|---|---|---|---|
| `decision` | enum | yes | `approve` \| `reject` |
| `reason` | string | no | min 1 chars; max 500 chars |
| `approvedMajor` | string | no | min 1 chars; max 120 chars |

### 3.5 `VerificationRevocationInput`

Source endpoint: `POST /api/student-verifications/{id}/revocation`

| Field | Type | Required | Notes |
|---|---|---|---|
| `reason` | string | yes | min 1 chars; max 500 chars |

---

## 4. Admin moderation flow investigation

### Confirmed endpoint surface

`docs/api/student-verification.md` and `student-verification.controller.ts` expose only:

1. `POST /api/student-verifications/documents`
2. `POST /api/student-verifications`
3. `POST /api/student-verifications/{id}/decision`
4. `POST /api/student-verifications/{id}/revocation`
5. `GET /api/student-verifications/me`

There is also the module scaffold status surface under `/api/student-verification/status` and `/api/student-verification/status/advance`, which is not a moderation list.

### Confirmation

There is **no endpoint that lists pending student verifications**.

### Limitation to document

- Admin moderation cannot start from a server-provided pending table in this phase.
- Any web admin review surface can only operate on a known `{id}`.
- No fake admin queue/list may be invented.

### How the admin reaches a verification id

Per TASK-01, the approved Phase 0 assumption is:

- **deep link**, or
- **notification**

Therefore the student-verification moderation flow is **decision/revocation by id only** unless a real list/read endpoint is added by backend work later. This Phase 0 plan does not authorize inventing a table, a search flow, or any local/mock source of pending verification ids.

---

## 5. Phase 0 outputs for downstream work

- Role gate source: `meResponseSchema.role`
- Allowed roles: `user`, `verifier`, `admin`
- Verifier route: `/${locale}/verifier`
- Learner route remains: `/${locale}/verification`
- Admin student-verification moderation remains: **by known id only**
- No contract/UI/gateway/test/code changes are part of this phase