# Landing, branding and Expo Web connectivity — plan

> Date: **2026-10-13** · Branch: `feat/midterm-presentation-readiness`
> Trigger: Expo Web could not reach the gateway, and the landing page was found to
> disagree with the rest of the app (logo, nav, dead links, density).

## Findings (all verified, not inferred)

| # | Finding | Evidence |
|---|---|---|
| F1 | **The gateway has no CORS and does not answer `OPTIONS`.** Expo Web runs in a browser and calls the API cross-origin from `localhost:8081` to `localhost:4000`, so the browser blocks every request. | `curl -D - http://localhost:4000/api/health -H "Origin: http://localhost:8081"` returns **no `Access-Control-Allow-Origin`**; `OPTIONS /api/health` returns **404**. No `enableCors` anywhere in `apps/gateway/src`. |
| F2 | **The logo exists on exactly one page.** The landing header renders `logo-skillswap-header.png`; every other page renders a different, invented mark. | `SiteHeader.tsx:29-36` uses the image; `navbar.tsx:114-119` renders a green `S` div + wordmark; mobile has no logo at all. |
| F3 | **The landing "Explore classes" link drops anonymous visitors into an auth-only screen.** | `SiteHeader.tsx:45` → `/classes`; `MarketplaceClient.tsx:33-34,60` documents `GET /classes` as authenticated and renders the `unauth` state on 401. |
| F4 | **The landing page has dead links.** "Sign in" is a real route, but every CTA and footer link is `href="#"`. | `CtaSection.tsx:45,52`; `SiteFooter.tsx:33,43,53`. Both files' own comments call them placeholders. |
| F5 | **The landing page is long and information-dense** — five full sections, three of them repeating the same trust/money claims in card grids. | `page.tsx:22-29` mounts SiteHeader + Hero + Trust (3 cards) + Money (3 cards) + Cta + SiteFooter. |

## Why the web app works and Expo Web does not

The Next.js app never makes a cross-origin call: `next.config.ts:8-15` rewrites
`/api/:path*` to the gateway, so the browser talks to its own origin
(`api-client.ts:3` says exactly this). Expo Web has no such proxy, so it hits
`http://localhost:4000` directly and is subject to CORS. **F1 is therefore a
real blocker for Expo Web only** — and it is a gateway gap, not a config mistake.

## Scope

Five phases, each its own commit. No new dependency is introduced.

### Phase L1 — Gateway CORS (F1) — the blocker

- `apps/gateway/src/config/gateway-config.ts`: add `corsOrigins: string[]`, read
  from `CORS_ORIGINS` (comma-separated). Default to **empty**, meaning CORS stays
  disabled, so production behaviour is unchanged unless explicitly configured.
- `apps/gateway/src/bootstrap/main.ts`: when `corsOrigins` is non-empty, set the
  CORS headers and answer preflight. Scoped to the same `/api` mount that already
  carries rate limiting and identity, so no route behaviour changes.
- `.env.example`: document `CORS_ORIGINS` with the local Expo Web origin as the
  comment example. Leave the developer's own `.env` alone except to add the line
  so Expo Web works locally.
- Tests: config parsing (empty → disabled; list → parsed and trimmed; `*` not
  silently accepted as a wildcard-with-credentials).

**Decision to state plainly:** CORS is opt-in by origin list, never `*`. The
gateway injects trusted identity headers, so a blanket wildcard would be a real
security regression, not a convenience.

### Phase L2 — One logo everywhere (F2)

- Extract the existing mark into a single `BrandMark` component used by both
  headers, replacing the invented `S` tile in `navbar.tsx`.
- Keep the landing's `logo-skillswap-header.png` as the source of truth; do not
  create a second asset.
- Sizing must match the landing header (`h-8`-class), and the navbar's compact
  height (64 px) must still hold — verify no layout shift on 360 px.
- Mobile: the app already shows the wordmark as a stack title. **Do not invent a
  mobile logo image**; record that mobile uses the text mark as a deliberate
  limitation rather than pretending parity.
- Tests: navbar renders the brand image with correct `alt`/`aria-label`.

### Phase L3 — Landing is auth-aware (F3)

- `SiteHeader.tsx` becomes auth-aware: a signed-in visitor keeps an "Explore
  classes" link, a guest is sent to `/auth?tab=login` with a `returnUrl` back to
  `/classes` so the intent survives the sign-in.
- This reuses the mechanism already in `AuthForm.tsx:116` (`returnUrl`), so no new
  auth concept is introduced.
- Do not gate the landing itself — only the link into the authenticated area.

### Phase L4 — No dead links (F4)

- `CtaSection.tsx`: the two `href="#"` CTAs point at the real auth entry, carrying
  the same `returnUrl`. Remove the now-untrue `aria-disabled`/`tabIndex={-1}`
  pattern and the comment claiming the routes do not exist.
- `SiteFooter.tsx`: the three `href="#"` links have **no destination** (no terms,
  escrow or transparency page exists). Two honest options, no third:
  1. remove them, or
  2. render them as non-interactive text.
  **Decision: remove them.** A footer link that does nothing is worse than no
  link, and inventing target pages is out of scope.
- Every remaining `href="#"` in the landing tree must be gone; the phase is not
  done while one remains.

### Phase L5 — Compress the landing (F5)

Cut length and repetition without deleting a single factual claim.

- Merge Trust (3 cards) and Money (3 cards) into **one** section that keeps the
  three strongest claims as compact rows rather than six boxed cards.
- Tighten section padding (`py-16` → `py-10`/`py-12`) and drop the eyebrow pills
  that only restate the heading.
- Remove the three empty placeholder `<span>&nbsp;</span>` markers in
  `TrustSection.tsx:69-72` and `MoneySection.tsx:66-68` — they render blank boxes.
- Keep every BR-cited statement (1 Credit = 1,000 VND, 90/10, held until
  completion). **Compaction means fewer boxes, not fewer facts.**
- Mobile-first 360 px, no horizontal scroll, `vi`/`en` never mixed (AGENTS.md).

## Explicitly out of scope

- Adding a terms / escrow / transparency page (L4 removes those links instead).
- Mobile branding parity beyond the text mark.
- Any change to authentication or the marketplace screen itself.

## Verification

`pnpm verify` green. New tests for L1 (config + preflight) and L2 (brand render).
Manual check that the landing still states every money/trust fact after L5, and
that no `href="#"` remains.
