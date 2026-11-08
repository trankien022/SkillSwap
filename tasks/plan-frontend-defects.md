# Plan — two frontend defects found while delivering B10 + B1–B7

Date: 2026-11-08
Origin: the "worth your decision" review after `e4587d5`; the user approved both fixes.
Base: `main` @ `e4587d5`

## Scope decision

Two defects, both decision-free, each landing as its own commit:

| Phase | Defect | Commit |
|---|---|---|
| P0 | `unreadOnly=false` parses to `true` — the one `z.coerce.boolean()` in the contracts | `fix(notifications): …` |
| P1 | `this-weekend` is a no-op in the live marketplace gateway | `fix(marketplace): …` |

Explicitly **not** in this plan, because they are decisions rather than defects (raised and
parked in the review above):

- B6's read routes have no client wiring yet (web fakes it locally, mobile cannot clear the
  badge). Backend work, done and tested; the call to wire it now or later is a scope decision.
- Mobile re-localises notification copy from its own `i18n/*.json` instead of rendering the
  server's `title`/`body`, so B7 only reaches web. Whether mobile's table is deliberate is a
  product decision.
- The university dropdown cannot filter live data (`schoolCode` has no wire source; the API
  sends free-text `schoolName`). Needs a product call: controlled vocabulary vs. free-text
  filter vs. remove the control.

## Shared invariants

- No wire-schema change of any *shape*: both fixes change how an existing parameter is
  interpreted or which existing branch runs. `pnpm docs:api` therefore has nothing to
  regenerate, but it still runs in P1 to prove the claim rather than assert it.
- Both defects are pre-existing, so each phase starts by pinning the broken behaviour in a test
  that fails for the right reason, then fixes it.
- `pnpm verify` green at the end of every phase.
- Backwards compatibility matters more than tidiness in P0: the fix must keep every input that
  works today working (see P0's accepted-set table).

## P0 — `unreadOnly=false` must mean false

**Defect.** `listNotificationsQuerySchema` is the only contract using `z.coerce.boolean()`.
`Boolean('false')` is `true`, and Node coerces every non-empty query string to `true`:

```
"true" -> true      "false" -> true      "0" -> true
"1"    -> true      ""     -> false     "no" -> true
```

So `GET /api/notifications?unreadOnly=false` returns **only unread** rows — the exact opposite
of the request. Pre-existing, unrelated to B6 (which only needs `true`), and no shipped client
sends `false`: mobile's `notification-gateway.ts` sets the param only when it is defined, and
web does not send it at all. Latent rather than active — but it is a live wrong answer for any
client that follows the documented parameter name.

**Fix.** Use the pattern the repo already established for exactly this hazard in
`myBookingsQuerySchema`:

```ts
upcoming: z.enum(['true', 'false']).transform((v) => v === 'true').optional()
```

Applied to `unreadOnly`, keeping `optional()` so an omitted parameter stays `undefined`
("no filter") rather than becoming `false` (which happens to behave the same today but says
something different).

**Accepted set, and why this is not a silent break.** Every string that produces the same
result today still produces it:

| Input | Before | After | Verdict |
|---|---|---|---|
| omitted | `undefined` | `undefined` | unchanged |
| `"true"` | `true` | `true` | unchanged |
| `"false"` | `true` (wrong) | `false` | fixed |
| `"0"`, `"no"` | `true` (wrong) | `400` | now rejected |
| `""` | `false` | `400` | now rejected |

Only garbage (`"0"`, `"no"`, empty) becomes a rejection, and a rejection is safer than
guessing. This mirrors `upcoming` exactly, so the two boolean query params in the codebase stop
disagreeing.

**Work.**
1. `packages/contracts/src/mobile-notifications.ts` — replace the one coercion.
2. `packages/contracts/src/mobile-notifications.spec.ts` — a `listNotificationsQuerySchema`
   block: `"true"`/`"false"` map to booleans, omitted stays `undefined`, `"0"`/`"yes"`/`""`
   rejected, `limit`/`cursor` unaffected.
3. `apps/api/.../sql-notification-management.ts` — no change needed; `if (query.unreadOnly)`
   already treats `false`/`undefined` as "no filter". Verify, don't assume.
4. A test proving the *route* honours it, at the level where the bug was observable — the
   controller→adapter path. The B7 evidence recorded the symptom; this pins the cure.

**Done when.**
- `GET /api/notifications?unreadOnly=false` returns read **and** unread rows, via the gateway.
- `GET /api/notifications?unreadOnly=true` still returns only unread.
- Both grep boxes in the task doc for this phase hold (one `notificationCopy`; no
  `z.coerce.boolean()` left in contracts).
- `pnpm verify` green.

## P1 — `this-weekend` must filter, or not be offered

**Defect.** `MockMarketplaceGateway` implements all three time filters. The live
`HttpMarketplaceGateway` implements only one:

```ts
if (query.timeFilter === 'next-24-48h') { … }   // the only branch
```

`all-valid` needs nothing — `fetchClasses` already sends `startDate: new Date().toISOString()`
and the API enforces the 24-hour lead time server-side (BR-021), so every returned row is
valid. `this-weekend` is simply absent: picking it changes nothing and the UI still shows a
checked radio, i.e. the control lies. `FilterSidebar` renders all three and `DEFAULT_QUERY`
sets `all-valid`.

**Fix.** Move `matchesTimeFilter` into a shared module both gateways import, so the mock and
the live path cannot drift again, and have the live gateway call it. The mock's semantics are
the spec: booking must be > 24h away (BR-021), and for `this-weekend` the class must fall on a
Saturday or Sunday.

Two judgement calls worth stating:
- **Reuse the mock's implementation, don't copy it.** A copy is how this drifted; the failing
  test would then have to be written twice and could pass in one place only.
- **`hour===0` handling stays as the mock has it.** `getDay()` in the *viewer's* timezone decides
  "weekend". The server cannot help: it has no `weekend` filter, and adding one is a contract
  change nobody asked for. Documented in a comment rather than silently assumed.

**Work.**
1. New `apps/web/src/lib/marketplace/time-filter.ts` — `matchesTimeFilter`, plus the `HOUR`
   constant, moved out of `mock-gateway.ts`.
2. `mock-gateway.ts` imports it. `http-gateway.ts` calls it in `applyClientFilters`.
3. `time-filter.test.ts` — pure unit tests with an injected `now` so the weekend boundary is
   testable (Sat/Sun in, Fri/Mon out, ≤24h always out).
4. `http-gateway.test.ts` (new) — stub `fetch` the way `booking/http-gateway.test.ts` does and
   assert the filter actually removes rows: `this-weekend` keeps only weekend classes,
   `next-24-48h` unchanged, `all-valid` unchanged. This is the regression test that would have
   caught the no-op.

**Done when.**
- `this-weekend` changes the result set in the live gateway (proved by test).
- The mock and the live gateway run the same function (one definition, imported twice).
- `pnpm docs:api` produces no diff — the wire is untouched.
- `pnpm verify` green.

## Out of scope, recorded so it is not lost

The three decisions from the review (B6 client wiring; mobile's own copy table; the university
dropdown) remain open. None of them is a defect: the backend is correct in each case, and what
is missing is a product call about the clients.
