# ADR-042 — The client-facing API is versioned; the vendor callbacks are not

**Status:** Accepted. Supersedes the recorded exception *"No `/api/v1` segment"* in
[`docs/plans/2026-10-19-restful-conventions-alignment-plan.md`](../plans/2026-10-19-restful-conventions-alignment-plan.md).
**Date:** 2026-11-10
**Level:** Software (C4 Level 3 · Component)

**Context.** Every public route lived at `/api/<resource>`: `setGlobalPrefix('api')` in
`apps/api/src/bootstrap/main.ts`, with the gateway mounting its proxy at the same prefix and
forwarding the path unchanged. There was no version anywhere in the surface.

That was a deliberate decision, recorded on 2026-10-19:

> No `/api/v1` segment (§3.3) — Additive-only contract; a version prefix would be new surface with
> no client to serve. Revisit at the first breaking change.

The reasoning was sound at the time and is not withdrawn. A version prefix is not free: it is a
permanent promise to keep serving an old shape. Adding one before any incompatible change exists
buys nothing and costs a segment on every URL forever.

Two things changed. First, the surface is no longer additive-only: `packages/contracts` and the
mobile client now ship independently of the API, so a change can reach a deployed mobile build that
cannot be recalled. Second, the request that produced this ADR asked for versioning directly, which
is the product decision the earlier exception said would justify revisiting.

The hard part is not adding a segment. It is that **three consumers of this surface are not in this
repository**:

1. **The SePay IPN.** `POST /api/wallet/top-ups/callback`. Its URL is configured *once* in the SePay
   dashboard against a fixed tunnel (`.env.example`). Change the path and payments stop settling —
   silently, because SePay treats a non-2xx as a retryable delivery failure.
2. **The JaaS presence webhook.** `POST /api/internal/jitsi/presence`. Its URL is registered in the
   8x8 console. Change the path and presence events stop arriving, which degrades class completion
   (AC-035). The gateway's own source carried a comment warning about exactly this.
3. **Installed mobile builds.** They cannot be force-updated.

And there were **two hand-maintained copies** of the public-path allow-list —
`apps/api/src/shared/http/trusted-identity.guard.ts` and
`apps/gateway/src/proxy/api-proxy.service.ts` — both hardcoding absolute paths. They had already
drifted in intent, which is why the gateway carried that warning comment. A list that must be
identical in two places and is checked in neither is a defect waiting for a webhook to expose it.

**Decision.**

1. **Version lives in the path, not a header.** `/api/v1/classes` rather than
   `Accept-Version: 1`. Header negotiation is the more correct content-negotiation answer, but the
   path is visible in logs, in the browser network tab, and in a `curl` a grader pastes. For this
   product, visibility wins.

2. **Use Nest's versioning, not a hardcoded prefix.** `app.enableVersioning({ type:
   VersioningType.URI, defaultVersion: '1' })` with the global prefix still `api`. The difference
   matters: `setGlobalPrefix('api/v1')` offers no way to exempt a route and forces the future `v2` to
   duplicate prefix strings. Nest's versioning keeps one prefix and lets a route opt out, which
   decision 3 requires. `defaultVersion: '1'` was also verified empirically *not* to dual-serve the
   unversioned path (probe: `/api/widgets` → 404, `/api/v1/widgets` → 200), which is why decision 4
   exists at all.

3. **Routes whose URL is owned by another system are `VERSION_NEUTRAL`.** They keep byte-identical
   paths:

   ```
   /api/wallet/top-ups/callback     unchanged  (SePay dashboard entry stays valid)
   /api/internal/jitsi/presence     unchanged  (8x8 console entry stays valid)
   /api/health                      unchanged  (Render/Vercel probe)
   /api/docs, /api/docs-json        unchanged  (describes all versions, so is not versioned)
   ```

   A version number we control has no meaning on a URL another organisation stores. Versioning these
   would buy nothing and risk money and class state, so the vendor configuration work for this change
   is zero — which is also why the change cannot break payments.

4. **The unversioned client paths keep working for one release.** Introducing versioning by breaking
   every deployed client in the same commit is backwards. `legacyPathRewrite()`
   (`apps/api/src/shared/http/legacy-path-rewrite.ts`) upgrades `/api/<x>` → `/api/v1/<x>` before
   routing, and refuses to touch anything decision 3 covers. `/api/v1/...` is canonical and
   documented; `/api/...` is a shim with a `TODO(versioning)` for its own removal.

5. **One public-path list, imported by both services.** It lives in
   `packages/contracts/src/http-paths.ts`, which both `apps/api` and `apps/gateway` may depend on
   (the arch rules forbid packages importing apps, not apps importing packages). Entries are written
   unversioned and matched through `normalizeApiPath`, so `/api/v1/auth/login` and the legacy
   `/api/auth/login` are recognised from one list. The gateway gained its `@skillswap/contracts`
   dependency for this.

**Consequences.**

- Every client route answers at `/api/v1/...`. The legacy form answers too until the shim is removed.
- The web client builds URLs from `API_PREFIX = API_BASE_PATH` in `api-client.ts`, and the mobile
  client from `API_BASE_PATH` in `infrastructure/config.ts`. A spec
  (`apps/web/src/lib/api-map.test.ts`) fails if any call site reintroduces the bare `/api` prefix —
  necessary because such a call site *works* through the shim and would otherwise survive review.
- `Swipe`-style double-prefixing is impossible from configuration: the mobile resolver strips a
  pasted `/api` **or** `/api/v1` before appending, and a test pins that `/api/v1/api/v1` cannot
  appear.
- `apps/mobile/src/infrastructure/http/api-evidence.ts` had to stop stripping `^/api` and start using
  `normalizeApiPath`. Left alone, every evidence entry would have silently vanished, because
  `/api/v1/classes` would become `/v1/classes` and match no template.
- The OpenAPI server URL is `/api/v1`, so generated docs and `pnpm docs:api` describe the canonical
  surface.
- `VERSION_NEUTRAL` was verified load-bearing: removing it from the JaaS controller makes
  `/api/internal/jitsi/presence` **404**, reproduced in
  `apps/api/test/api-versioning.e2e-spec.ts`.

**Alternatives rejected.**

- *Version at the gateway by rewriting `/api/v1/*` → `/api/*`, leaving the API unversioned.* This
  keeps vendor URLs stable for free, but the generated OpenAPI document would describe `/api/*`
  while the public surface is `/api/v1/*` — docs that are wrong about the thing they exist to
  describe. It also leaves no single place that knows the version.
- *Hard cutover to `/api/v1` with no shim.* Cleaner final state, but it requires the API, web and
  mobile to deploy atomically and breaks every installed mobile build at the moment of deploy.
- *Version the vendor callbacks too, and update the SePay and 8x8 consoles.* Those consoles are not
  reachable from this repository, the change is unverifiable from here, and the benefit is nil: we
  will never run a `/v2` of a webhook another organisation calls.
- *Header-based versioning.* See decision 1.
- *Leave the duplicated allow-list and add a test that compares the two copies.* Parsing TypeScript
  from a test to prove two arrays match is more fragile than deleting one of them.

**Removal follow-up.** When the web and mobile clients have shipped on `v1`, delete
`legacyPathRewrite()` and its call sites in `main.ts` and `test/harness.ts`. The e2e spec's
"legacy unversioned path" assertions become the signal that the shim is still present.
