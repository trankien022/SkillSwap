# P0 — `unreadOnly=false` was read as true

Date: 2026-11-08
Plan: [`../plan-frontend-defects.md`](../plan-frontend-defects.md) §P0
Found in: [`b7-notification-locale.md`](b7-notification-locale.md) §"Gap found"

## What was wrong

`listNotificationsQuerySchema` was the only place in `@skillswap/contracts` using
`z.coerce.boolean()`. `z.coerce` calls `Boolean()`, and `Boolean('false')` is `true` — so the
string never meant false:

```
"true"  -> true      "false" -> true      "0" -> true
"1"     -> true      ""      -> false     "no" -> true
```

Node hands every query parameter over as a string, so
`GET /api/notifications?unreadOnly=false` returned **only unread** rows — the exact opposite of
the request, with no error to notice.

Pre-existing and unrelated to B6/B7 (both only ever need `true`). Latent rather than active in
the shipped apps: mobile's `notification-gateway.ts` sets the parameter only when it is defined,
web does not send it at all. But it is a wrong answer for any client that reads the documented
parameter name and sends `false` — which is the natural thing to do.

## What changed

| File | Change |
|---|---|
| `packages/contracts/src/mobile-notifications.ts` | `z.coerce.boolean()` → `z.enum(['true','false']).transform((v) => v === 'true')` |
| `packages/contracts/src/mobile-notifications.spec.ts` | a `listNotificationsQuerySchema — unreadOnly` block (4 tests) |
| `apps/api/.../notifications.controller.ts` | `ZodValidationPipe<unknown>` + the exported input type, so the transform type-checks (the pattern `my-bookings.controller.ts` already uses) |
| `apps/api/.../sql-notification-management.spec.ts` | `unreadOnly filter` block (3 tests) proving the adapter's three cases |

**The fix is the repo's existing precedent, not a new invention.** `myBookingsQuerySchema`
solved this exact hazard the same way for `upcoming`:

```ts
upcoming: z.enum(['true', 'false']).transform((v) => v === 'true').optional()
```

After this change the two boolean query parameters in the codebase cannot disagree. The adapter
needed no change: `if (query.unreadOnly)` already treated `false` and `undefined` as "no filter".

## Accepted set — what this does and does not break

| Input | Before | After | Verdict |
|---|---|---|---|
| omitted | `undefined` | `undefined` | unchanged |
| `"true"` | `true` | `true` | unchanged |
| `"false"` | `true` (wrong) | `false` | **fixed** |
| `"0"`, `"1"`, `"no"`, `"yes"` | `true` / `true` / `true` / `true` (wrong) | `400` | now rejected |
| `""` | `false` | `400` | now rejected |

Only garbage becomes a rejection, and a 400 is safer than guessing. Every input that worked
still works.

## Evidence — through the gateway, with real events

A real cancellation (`POST /api/classes/:id/cancel`, class with 2 confirmed bookings) produced
the inbox rows; the consumer is asynchronous, so the probe polls for them rather than assuming.
One row was then marked read, so the inbox genuinely held both kinds.

```
POST /api/classes/:id/cancel   -> 200 OK
POST /api/notifications/:id/read -> 201 unreadCount=2

unreadOnly=false   status=200 items=3 read=1 unread=2 unreadCount=2
unreadOnly=true    status=200 items=2 read=0 unread=2 unreadCount=2
omitted            status=200 items=3 read=1 unread=2 unreadCount=2
```

```
PASS  unreadOnly=false returns read rows too
PASS  unreadOnly=false returns unread rows too
PASS  unreadOnly=true returns only unread
PASS  unreadOnly=true count == unreadCount
PASS  omitted == unreadOnly=false
PASS  unreadOnly=false is a superset of true
PASS  the marked row is in false but not true
```

`unreadOnly=false` now returns 3 rows; before the fix the same request returned 2 — the unread
half only. The marked row appears under `false` and is gone from `true`, which is the whole
point of the parameter.

**Garbage no longer guesses:**

```
unreadOnly="0"   -> 400
unreadOnly="no"  -> 400
unreadOnly="yes" -> 400
unreadOnly=""    -> 400
```

**The tests failed before the fix, for the right reasons.** Against the old schema:
`"false"` produced `true` (assertion expected `false`) and all six garbage values were accepted
instead of rejected — 2 failed, 6 passed. After the change: 8 passed.

## Decisions recorded

1. **Follow `upcoming`, don't invent a third convention.** Two schemas in one codebase treating
   the same query-string hazard differently is worse than either choice alone. `z.enum` +
   `transform` is already reviewed, tested, and shipping for `upcoming`.
2. **Reject garbage rather than coerce it.** `"0"` and `"no"` are not booleans in this API's
   vocabulary; accepting them means silently picking an interpretation. `upcoming` already
   rejects them, and the 400 names the parameter.
3. **Keep `optional()`.** An omitted `unreadOnly` must stay `undefined` ("no filter"), not become
   `false`. They behave identically in the adapter today, but `undefined` is the honest value and
   keeps the door open for a future tri-state.
4. **Change the controller's pipe to `ZodValidationPipe<unknown>`, not the pipe itself.** A
   schema with a transform has different input and output types, which `ZodValidationPipe<T>`
   deliberately cannot express. Relaxing the shared pipe for one route would have blunted a type
   guarantee for all of them; parametrising the call site is what `my-bookings.controller.ts`
   already does.

## Noticed, not touched

`tasks/mobile-contracts.md` still shows the old `z.coerce.boolean()` snippet (and `limit … max(50)`
where the live schema says 100). It is a stale Vietnamese handoff excerpt, not a spec the code
is generated from, so it is left alone rather than half-corrected.

## Gates

- `pnpm verify` — green: lint (`--max-warnings=0`), build, typecheck, all suites, depcruise
  1010 modules / 2933 dependencies, 0 violations
- `@skillswap/contracts` — 11 suites, 242 tests (+4)
- `@skillswap/api` — 157 suites, 1048 tests (+3)
