# P1 — "this weekend" did nothing

Date: 2026-11-08
Plan: [`../plan-frontend-defects.md`](../plan-frontend-defects.md) §P1

## What was wrong

The marketplace had two gateways and two notions of what a time filter means:

| Filter | `MockMarketplaceGateway` | `HttpMarketplaceGateway` |
|---|---|---|
| `all-valid` | `> 24h` | not handled (relied on the API) |
| `next-24-48h` | implemented | implemented |
| `this-weekend` | implemented | **missing entirely** |

In the live adapter — the one the real `/classes` page uses — `applyClientFilters` contained a
single time branch. Choosing "Cuối tuần này" in the sidebar left the result set exactly as it
was, while the radio still rendered as selected. A control that reports itself as applied and
does nothing is worse than an absent control: the learner reads an unfiltered list as "these are
the weekend classes".

The plan's own test run confirms the shape of the defect — three assertions failed and the two
control assertions passed:

```
× keeps only Saturday and Sunday classes for this-weekend
× does not treat every class as a weekend class
✓ narrows next-24-48h to the 24-48h window, as before
✓ leaves all-valid to the API, which already enforces the 24h lead time
× excludes a weekend class that is inside the 24-hour booking window (BR-021)
```

## What changed

| File | Change |
|---|---|
| `apps/web/src/lib/marketplace/time-filter.ts` (new) | `matchesTimeFilter(startsAt, filter, now?)` — one definition, injectable clock |
| `apps/web/src/lib/marketplace/mock-gateway.ts` | deletes its private copy; imports the shared one |
| `apps/web/src/lib/marketplace/http-gateway.ts` | calls the shared one in `applyClientFilters` |
| `apps/web/src/lib/marketplace/time-filter.test.ts` (new) | 6 tests, deterministic clock |
| `apps/web/src/lib/marketplace/http-gateway.test.ts` (new) | 5 tests over a stubbed `fetch` — the seam that would have caught the no-op |

The predicate moved rather than being copied. A copy is precisely how the two gateways drifted
apart; a copy would also let the failing test pass in one file and fail in the other.

## Evidence — the defect is gone, and the two gateways cannot disagree

The live-gateway tests assert on filtered output, not on a predicate called in isolation:

```
✓ keeps only Saturday and Sunday classes for this-weekend
✓ does not treat every class as a weekend class
✓ narrows next-24-48h to the 24-48h window, as before
✓ leaves all-valid to the API, which already enforces the 24h lead time
✓ excludes a weekend class that is inside the 24-hour booking window (BR-021)
```

Fixed clock: Wednesday 2026-11-11 12:00 UTC. Fixtures at Wed +34h, Sat +40h, Sun +64h, Mon +90h.
`this-weekend` returns exactly the Saturday and Sunday rows; with only weekday fixtures it
returns none — the case that used to return everything.

The shared predicate is covered directly, with the clock injected so the weekend boundary does
not depend on the day the suite happens to run:

```
✓ all-valid accepts a class exactly 24h away, matching the server boundary
✓ all-valid rejects a class inside the 24-hour booking window (BR-021)
✓ next-24-48h keeps only the 24-48h band
✓ this-weekend keeps Saturday and Sunday
✓ this-weekend drops weekdays
✓ this-weekend drops a weekend class that is not yet bookable (BR-021)
```

Every pre-existing marketplace suite still passes untouched, including
`mock-gateway.test.ts` — the mock's observable behaviour is unchanged by the move, which is what
`all-valid`'s boundary fix below had to preserve.

## Decisions recorded

1. **One predicate, imported twice.** The defect was two implementations drifting; the fix
   cannot be a third implementation that happens to agree today.
2. **`all-valid` now means `>= 24h`, matching the server.** The mock used `> 24h`, the server
   accepts the exact boundary (`get-class-detail.query.ts` and `list-classes.query.ts` both
   document the exact edge as bookable, with explicit tests). Sharing one definition forced the
   question, and the server is right: a class exactly 24 hours away is bookable, so a client
   filter must not hide it. On live data this changes nothing — the API has already applied the
   rule — but the mock now matches reality instead of being 1ms stricter.
3. **The clock is injectable.** `matchesTimeFilter(startsAt, filter, now = new Date())`. A
   weekend test whose result depends on when it runs is a flaky test, and the boundary is exactly
   where the logic lives.
4. **"Weekend" is decided in the viewer's timezone.** `getDay()` on the parsed date. The server
   has no weekend filter and adding one is a contract change nobody asked for; a learner reading
   "this weekend" means their weekend, not UTC's.
5. **No new contract, no new endpoint.** The wire is untouched — `pnpm docs:api` regenerated all
   nine module pages and produced no diff, which is the check the plan asked for.

## Gates

- `pnpm verify` — green: lint (`--max-warnings=0`), build, typecheck, all suites, depcruise
  1013 modules / 2938 dependencies, 0 violations
- `@skillswap/web` — 53 files, 431 tests (was 51 / 420)
- `pnpm docs:api` — regenerated, no diff (no wire schema changed)
