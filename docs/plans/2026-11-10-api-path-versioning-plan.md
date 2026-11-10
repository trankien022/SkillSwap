# Plan — version the public API under `/api/v1`

**Date:** 2026-11-10
**Request:** "current api does not have versioning, can you add version for all api in backend
like api/v1 and update fe to use the v1 ones?"
**Status:** implemented — Phases 1–5 landed. Decision record: [ADR-042](../adr/ADR-042-api-path-versioning.md).
Phase 6 (shim removal) deferred by design.

## What "versioning" has to decide

Four separate questions hide inside the request. They can be answered independently, and
the answers are not all yes.

1. Does a version segment go in the **path** (`/api/v1/...`) or in a header?
2. Does **every** route get versioned, including internal and vendor-callback routes?
3. Do we **keep** unversioned paths working, or hard-cut over?
4. What is the **version** — a literal `v1`, or Nest's own versioning machinery?

## What exists today

- `apps/api/src/bootstrap/main.ts:23` — `app.setGlobalPrefix('api')`. Same in
  `apps/api/test/harness.ts:63`. No versioning configured.
- `apps/gateway` mounts `app.use('/api', proxy...)` and forwards `originalUrl`
  unchanged, so the gateway adds no segment of its own. It is a pass-through.
- `apps/web/src/lib/api-client.ts` builds `${API}/api${path}`, with five more
  hand-written `/api/...` URLs beside it (refresh, register, login, me, logout).
- `apps/mobile/src/infrastructure/config.ts:79` computes `apiBaseUrl = ${base}/api`.
- **24 controllers** expose routes today.

## The part that makes this dangerous

Adding a segment is not a rename, because three groups of consumers are **not in this
repo**:

1. **SePay IPN.** The callback URL is configured *once* in the SePay dashboard, against a
   fixed ngrok tunnel to the API (`.env.example:138-143`). Changing the path breaks payment
   settlement silently until someone edits the dashboard.
2. **JaaS presence webhook.** The URL is registered in the 8x8 console. A wrong path means
   presence events stop arriving, which degrades class completion (the code is explicit
   about this: `AC-035`, and the gateway's own comment says a missing entry here "silently
   costs early class completion").
3. **Deployed clients.** Both published frontends call unversioned paths. A hard cutover
   breaks them mid-flight.

And there are **two hand-maintained copies** of the public-path allow-list that both
hardcode absolute paths:

- `apps/api/src/shared/http/trusted-identity.guard.ts:5-25`
- `apps/gateway/src/proxy/api-proxy.service.ts:18-32`

Neither uses the global prefix constant. Both must change in lockstep, or a webhook that
was public becomes 401 — and the failure is silent.

`docs/plans/2026-10-19-restful-conventions-alignment-plan.md:146` already recorded the
absence of `/api/v1` as a deliberate exception: *"Additive-only contract; a version prefix
would be new surface with no client to serve. Revisit at the first breaking change."* This
request is that revisit, so the exception is superseded rather than violated — but the
justification it gave still applies to the mechanism chosen below.

## Decisions

### D1 — Path versioning, not header versioning

`/api/v1/classes` rather than `Accept-Version: 1`. The path is visible in logs, in the
browser network tab, in a curl command a grader pastes, and in the OpenAPI doc. Header
versioning is more "correct" for content negotiation but is invisible and harder to demo.
For a course project with a live demo, visibility wins.

### D2 — Use Nest's own versioning, enabled *additively*

`app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })` with the global
prefix staying `api`. Nest 11 supports this (`@nestjs/common` `^11.0.0`), including
`VERSION_NEUTRAL` per route.

Why Nest's machinery and not `setGlobalPrefix('api/v1')`: the latter gives no way to exempt
a route, and no future `v2` without duplicating prefix strings. Nest's versioning keeps one
prefix and lets individual routes opt out — which D3 requires.

### D3 — Internal and vendor-callback routes stay VERSION_NEUTRAL

This is the important one. `/internal/jitsi/*` and `/wallet/top-ups/callback` are called by
*servers in other organisations*, whose registered URLs we cannot change from here. They are
not part of the public client contract, so a client-API version number does not apply to
them.

They get `@Version(VERSION_NEUTRAL)`, which keeps their paths byte-identical to today:

```
/api/wallet/top-ups/callback     unchanged   (SePay dashboard entry stays valid)
/api/internal/jitsi/presence     unchanged   (8x8 console entry stays valid)
```

Meanwhile every client-facing route becomes `/api/v1/...`. The vendor configuration work
drops to zero, which also means this change cannot break payments.

`/api/health` is also version-neutral. It is an infrastructure probe, not a contract, and
Render/Vercel health checks point at it.

### D4 — Dual-serve the unversioned client paths for one release

Versioning exists to *protect* clients during change; introducing it by breaking every
client in the same commit is backwards. So:

- `/api/v1/<route>` is the canonical, documented, frontend-facing surface.
- `/api/<route>` keeps working for existing clients, implemented by mounting the same
  controllers at a second, deprecated path — then removed in a follow-up once web and mobile
  ship on `v1`.

Concretely: keep `defaultVersion: '1'` for canonical paths, and add a small
`LegacyPathMiddleware` (API-side) that rewrites an unversioned client request
`/api/<x>` → `/api/v1/<x>` before Nest routes it, excluding `VERSION_NEUTRAL` paths, `/api/docs*`
and `/api/health`. This is a compatibility shim, clearly marked for removal, and it is what
makes the web/mobile migration landable in separate commits.

If you would rather **hard-cut** (no legacy paths, deploy API + web + mobile together), say
so — it removes ~40 lines of shim but requires a coordinated deploy and breaks any already
installed mobile build.

### D5 — One constant, referenced by both allow-lists

`PUBLIC_PATHS` exists twice, hardcoded, and already has a documented silent-failure mode.
Introduce `apps/api/src/shared/http/public-paths.ts` exporting the list, and have the
gateway import the *same* shape from a shared location (or, if a cross-app import is
unacceptable under the dependency rules, generate both from one source and add an arch test
asserting they are equal). The arch test is the real deliverable: the two copies diverging
is the bug, and it should fail CI rather than a webhook.

## Phases

Each phase is its own commit and leaves `pnpm verify` green.

### Phase 1 — Enable versioning, no path changes yet

- `enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })` in
  `main.ts` and `test/harness.ts`.
- Mark `/health`, `/internal/jitsi/*`, `/wallet/top-ups/callback` as `VERSION_NEUTRAL`.
- Update `PUBLIC_PATHS` in both allow-lists to match the new reality; add the arch test that
  keeps them identical.
- Add e2e assertions: `/api/v1/classes` routes, `/api/health` still 200,
  `/api/internal/jitsi/presence` still reachable without user headers.
- **Proof:** the e2e suite fails before the `VERSION_NEUTRAL` annotations (jitsi/callback
  404) and passes after.

### Phase 2 — Legacy compatibility shim

- `LegacyPathMiddleware`: rewrite unversioned client paths to `/api/v1/...`.
- Tests: `/api/classes` and `/api/v1/classes` both resolve; neutral paths are *not* rewritten;
  `/api/docs` is untouched.
- **Proof:** without the middleware, `/api/classes` 404s — that is the failing test.

### Phase 3 — Web client on v1

- `api-client.ts`: one `API_VERSION` constant, `${API}/api/v1${path}`.
- The five hand-written URLs beside `callApi` collapse onto the constant (this is also a
  small cleanup — five literals is why they drifted).
- `lib/status.ts` and `status-check.tsx` stay on `/api/health` (neutral, by D3).
- `lib/api-map.test.ts` is the natural place to pin this: assert every scanned call site
  resolves under `/api/v1` and none under a bare `/api/`.
- **Proof:** the api-map test fails if any call site is left unversioned.

### Phase 4 — Mobile client on v1

- `apps/mobile/src/infrastructure/config.ts:79` → `${gateway}/api/v1`; update `config.spec.ts`
  expectations.
- Fix the `/api`-stripping helper so a pasted base URL ending in `/api/v1` does not double
  version.
- **Proof:** config spec asserts `.../api/v1` and rejects `.../api/v1/api/v1`.

### Phase 5 — Docs and OpenAPI

- `pnpm docs:api` regenerated; confirm every path reads `/api/v1/...` except the neutral ones.
- `docs/api/FRONTEND-API-MAP.md`, `FRONTEND-API-GUIDE.md`, `RESTful-CONVENTIONS.md` updated.
- New `docs/adr/ADR-042-api-path-versioning.md` recording D1–D5, and mark the
  `2026-10-19` exception row as superseded (append, don't rewrite history).

### Phase 6 — Remove the shim (separate PR, after web/mobile ship)

Not in this PR. Recorded so the legacy path does not become permanent.

## Verification

- `pnpm verify` green per phase; `pnpm test:e2e` for Phases 1–2 (needs postgres + rabbitmq).
- Manual: `GET /api/v1/classes` 200, `GET /api/classes` 200 (Phase 2+),
  `GET /api/health` 200, and a replay of the JaaS webhook path returning its normal
  4xx-not-404 (proving routing, not auth, is unchanged).

## As built

Deviations from the sketch above, all recorded rather than silently changed:

| Planned | As built | Why |
|---|---|---|
| Phase 2 adds a `LegacyPathMiddleware` | `legacyPathRewrite()` in `apps/api/src/shared/http/legacy-path-rewrite.ts` | Same mechanism, one file, applied in `main.ts` and `test/harness.ts` so e2e covers real routing rather than a copy of it. |
| D5: one constant, "or an arch test if a cross-app import is unacceptable" | One constant, imported directly from `packages/contracts/src/http-paths.ts`; no arch test needed | The arch rules forbid packages importing apps, not apps importing packages. The gateway took a `@skillswap/contracts` dependency, which deletes the duplication instead of policing it. |
| Phase 1 "add the arch test that keeps them identical" | Not written | Obsolete: there is now one list, so there is nothing to keep in sync. A test comparing two copies would only exist to prove a duplication that no longer exists. |
| Phase 3 changes `api-client.ts` only | Also `api-map.test.ts` matcher + a new negative guard | The scanner keyed on the literal `${API}/api` shape; without updating it, it would have matched nothing and "passed" vacuously. |
| Phase 4 changes `config.ts` only | Also `api-evidence.ts` | `evidenceRoute` stripped `^/api`; under `/api/v1` it would have matched no template and silently recorded nothing. Caught while reading the callers, not by a failing test — so a spec was added for the double-prefix case. |

Two empirical findings changed the plan:

1. **`defaultVersion` does not dual-serve the unversioned path.** Probed with a throwaway Nest app:
   `/api/widgets` → 404, `/api/v1/widgets` → 200, `/api/health` → 200 (`VERSION_NEUTRAL`),
   `/api/v1/health` → 404. So Phase 2's shim is genuinely required, not redundant with the
   `defaultVersion` option.
2. **`VERSION_NEUTRAL` is load-bearing for the JaaS webhook.** Removing it from
   `JitsiPresenceController` makes `/api/internal/jitsi/presence` return 404 — verified by reverting
   the annotation and re-running `api-versioning.e2e-spec.ts` (2 tests fail, 10 pass). Restored.

Proof that each phase's test fails without its change:

- `api-versioning.e2e-spec.ts` (12 tests): 2 fail with the JaaS annotation removed.
- `api-map.test.ts` (5 tests): the new negative guard fails when `fetch(\`${API}/api/auth/refresh\`)`
  is reinstated in `api-client.ts`.
- `http-paths.test.ts` (21 tests): written first; the one assertion I got wrong
  (`/api/auth/logout-all-accounts` being public) was corrected to match the safe behaviour, which
  the implementation already had.

## What I will not do

- I will not touch the SePay dashboard or 8x8 console entries — D3 means they should not
  need touching, and I cannot reach them anyway.
- I will not hard-cut the unversioned paths without an explicit decision (D4).
- I will not add a `v2`, or a version-negotiation mechanism, or version the event/queue
  topology: the request is about HTTP surface only.

## Open questions

1. **D4:** dual-serve unversioned paths for a release (my recommendation), or hard-cut?
   Hard-cut is cleaner but requires API + web + mobile to deploy together and breaks
   installed mobile builds.

   **Resolved:** dual-serve, per ADR-042 decision 4.

2. Should `/api/docs` move under `/api/v1/docs`? I recommend leaving it — it documents all
   versions, so it is not itself versioned.

   **Resolved:** left unversioned, as `VERSION_NEUTRAL`.
