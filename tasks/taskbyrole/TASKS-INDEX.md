# SkillSwap — Missing API-call & FE-handling Task Index

> Companion to the two mapping docs:
> - `SkillSwap-WEB-FE-API-Mapping.md`
> - `SkillSwap-MOBILE-FE-API-Mapping.md`
>
> Every task below exists because the endpoint is **documented in `docs/api/` but no frontend calls it**, or a frontend method is **declared but not wired to a screen**.
> Source of truth for what is missing: **§3 Coverage check** in each mapping doc. Reconciled against commit `508df82`.

---

## 1. Who gets what (equalised)

| Task doc | Owner | Platform | Workstream | Weight |
|---|---|---|---|---|
| `TASK-01-web-verification-moderation.md` | **Long** | Web | Verifier queue/claim/decision + admin student-verification review + the broken document `PUT` | **Heavy** |
| `TASK-02-mobile-moderation-mirror.md` | **Nhật Anh** | Mobile | Verifier queue/claim/decision on mobile + learner no-show wiring | **Medium** |
| `TASK-03-web-booking-reads.md` | **Tấn Hưng** | Web | Booking read gap + `/verifiers/{accountId}/status` admin control + FR-014 honesty | **Medium** |
| `TASK-04-mobile-fixes-hardening.md` | **Vũ Hưng** | Mobile | `GET /api/classes/{id}` dedicated read + tests + i18n/UX hardening | **Light–Medium** |

**Why the load moved (v1 → v2).** v1 assigned web a verification monster and everyone else mostly inventing work. This version drops every invented item and re-balances:

| v1 (wrong) | v2 (this) |
|---|---|
| TASK-02 web: build an `/ops` status page over `*/status` probes | **Deleted.** Those are codegen scaffolds, not features. |
| TASK-04 mobile: build a `/health` screen | **Deleted.** `/health` is a load-balancer probe. |
| TASK-02 web: wire web push device registration | **Deleted** as a task; recorded as *optional, only if web push is ever built*. |
| TASK-03 mobile: wire `no-show` yourself | Moved to TASK-02 (mobile) so web loses one endpoint and mobile gains one. |
| — | **new** TASK-04: verified real bug — mobile has no `/classes/{id}` read. |
| Long had 6 endpoints | Long has 5 endpoints **plus** the broken upload `PUT` (genuinely the largest single piece). |

---

## 2. The real gaps, in one table

| # | Endpoint / bug | Web | Mobile | Owner |
|---|---|---|---|---|
| 1 | `GET /api/verifiers/me/queue` | ❌ | ❌ | Long (web) · Nhật Anh (mobile) |
| 2 | `POST /api/skill-evidence/{id}/claim` | ❌ | ❌ | Long · Nhật Anh |
| 3 | `POST /api/skill-evidence/{id}/decision` | ❌ | ❌ | Long · Nhật Anh |
| 4 | `POST /api/student-verifications/{id}/decision` | ❌ | ❌ | Long |
| 5 | `POST /api/student-verifications/{id}/revocation` | ❌ | ❌ | Long |
| 6 | Pre-signed document `PUT` (S3, not `/api`) | ❌ **broken** | ✅ | Long |
| 7 | `POST /api/classes/bookings/{bookingId}/no-show` | ✅ | ❌ **unwired** | Nhật Anh |
| 8 | `POST /api/verifiers/{accountId}/status` | ✅ action-by-id | ❌ | Tấn Hưng (web) |
| 9 | Mobile never calls `GET /api/classes/{id}` | ✅ | ❌ | Vũ Hưng |
| 10 | Fake presentation IDs (`roomCode`, `receiptId`) leaking into UI | ✅ removed (TASK-03 Phase 2) | — | Tấn Hưng |
| 11 | Web withdrawal screen implies a working flow | ✅ blocked + banner (TASK-03 Phase 3) | — | Tấn Hưng (record only) |

### Out of scope by policy — do **NOT** assign or “fix”

| Endpoint | Why it stays ❌ forever |
|---|---|
| `GET`/`POST /api/wallet/top-ups/callback` | **SePay-only.** Served under IP allow-list. A client calling these is a security bug. |
| `GET /api/health` | **Load-balancer / CI liveness probe.** Raw, unenveloped. `docs/diagrams/checkpoint/README.md`: *"Health/status scaffold routes must not be counted as meaningful business endpoints."* |
| `*/status` + `*/status/advance` (×7 modules) | **Codegen scaffolds** from `scripts/generate-api-modules.mjs`. `docs/plans/2026-10-12-midterm-presentation-readiness-plan.md` subtracts them from the endpoint count: *"53 − 14 scaffold (`/status`, `/status/advance` × 7 module) − 1 health"*. `domain/module-status.ts` is a 3-state machine (`active｜frozen｜closed`) with no product feature behind it. |
| `POST /api/notification-devices` / `DELETE /{id}` (web) | Not a defect. Push-token registration; the only client with a push token is mobile. Optional **only if** web push is ever built. |
| Withdrawal (`FR-014`) | **No backend endpoint exists.** Backend task, not FE. |

---

## 3. Hard rules every task inherits (from `AGENTS.md`)

1. **Plan before code.** Each task starts by landing a short phased plan (its own commit), then one commit per phase.
2. **`pnpm verify` must be green** before a task is claimed done (`pnpm lint`, `build`, `typecheck`, `test`, `test:arch`).
3. **No mock fallbacks.** If the API fails, show an error state — do **not** synthesise data. *(Exception, TASK-04: mobile's `EXPO_PUBLIC_API_BASE_URL`-unset fallback is pre-existing legal debt — verify it, do not extend it.)*
4. **Server truth only.** Never compute or cache balances/statuses locally; re-read from the API.
5. **Never auto-replay a POST.** Web `callApi` and mobile `GatewayClient` already honour this — reuse them, do not hand-roll `fetch`.
6. **Contracts first.** Add/extend Zod schemas in `packages/contracts`; do not invent response shapes.
7. **Design from `DESIGN.md`** (register `product`): status = **text + colour**, vn/en never mixed on one screen, mobile-first 360 px.
8. **Commits:** `type(scope): msg` — enforced by `githooks/commit-msg`.
9. **Do not edit `ARCHITECTURE.md`.** If a decision is needed, add an ADR in `docs/adr/`.

---

## 4. The shared blocker — already resolved, do not re-guess

Role gating was v1's open risk. It is **settled in source**:

- **Roles are `user | verifier | admin`** (`docs/diagrams/checkpoint/README.md` §63, citing ADR-030).
- Learner/Teacher are **capabilities of an ordinary `user` account**, not roles.
- Public registration accepts **`user` only**; verifier/admin identities are provisioned out of band (ADR-029).
- Enforcement is server-side via `@Roles(...)` on the controller (`apps/api/.../verifier.controller.ts`, `student-verification.controller.ts`); the client only needs to hide UI it cannot use, and surface real `403`s.

**Action for TASK-01 / TASK-02:** read `packages/contracts` for the exact `role` schema and confirm the string values, then gate UI on them. **Do not build a new auth flow** — a verifier signs in through the existing login.

**FR-014 (withdrawal)** stays blocked: no endpoint. TASK-03 records it; nobody invents one.

---

## 5. Suggested order

1. **TASK-04 (Vũ Hưng)** — smallest, unblocks a real mobile bug (`GET /classes/{id}`). Land first.
2. **TASK-02 (Nhật Anh)** — mobile no-show is a quick win; then the verifier queue after Long publishes the web contracts.
3. **TASK-03 (Tấn Hưng)** — independent web work; can start immediately.
4. **TASK-01 (Long)** — largest; start first if calendar length matters, since TASK-02 reuses its contract work.

**Cross-task dependency:** TASK-01 (web) and TASK-02 (mobile) touch the same three verifier endpoints. **Long publishes the Zod contracts in `packages/contracts` first**; Nhật Anh consumes them rather than defining a second shape. Agree the route names in one shared plan before either writes UI.

Each task doc is self-contained and ends with a **Definition of done** the owner can self-check.
