# B6 — notification read state lives on the server

Date: 2026-11-07
Task: B6 of `../../../2026-11-07-backend-remaining-work.md`

## What was wrong

`inbox_notifications.read` has existed since `1791072000006`, and both apps render an unread badge
from it — but nothing on the server could ever change it. The web faked it in local state
(`setItems(current => current.map(item => ({...item, unread: false})))`), so a page reload restored
every notification to unread; mobile could not clear the badge at all. There was no route to call.

## What changed

| File | Change |
|---|---|
| `application/port/notification-management.ts` | `markRead(accountId, id) → number \| null` (null = no owned row), `markAllRead(accountId) → number` |
| `adapter/out/persistence/sql-notification-management.ts` | `markRead`: one `UPDATE … WHERE "id" = $1 AND "account_id" = $2 RETURNING "id"`, then the existing unread-count query. `markAllRead`: one `UPDATE … WHERE "account_id" = $1 AND "read" = false` |
| `adapter/in/web/notifications.controller.ts` | `POST read-all` and `POST :id/read`, both through the same `currentUserId` guard the existing `@Get()` uses; `markRead` answers 404 when the update touched no row |
| `adapter/in/web/dto/notifications.dto.ts` | `MarkNotificationsReadDto` |
| `packages/contracts/src/mobile-notifications.ts` | `markNotificationsReadResponseSchema` = `{ success: true, unreadCount: int ≥ 0 }`, exported through the barrel |
| `packages/contracts/src/mobile-notifications.spec.ts` (new) | schema cases |
| `notifications.controller.spec.ts` (new) | read-state cases + the route-order guard |
| `sql-notification-management.spec.ts` | adapter cases for both statements |

No migration: the `read` column and `ix_inbox_account_created` already existed.

## Evidence

**Ownership is in the `WHERE` clause, so a foreign id is indistinguishable from a missing one**

```
A (user7) marks B (user10)'s notification  -> 404 {"code":"HTTP_404","message":"Notification not found"}
   B's row read flag after A's attempt: false   B unreadCount: 1
A marks an id that exists nowhere          -> 404 {"code":"HTTP_404"}
```

There is no `SELECT` before the `UPDATE`; a read-then-write would let "not yours" and "not there"
produce different answers, which is exactly the existence leak the 404 is there to avoid.

**Marking one of several, then the rest** — five real inbox rows (three unread) built through the
event pipeline (`class.cancelled` and two `booking.confirmed` settlements), not inserted by hand:

```
GET /api/notifications                    -> 5 items, unreadCount 4
POST /api/notifications/<id>/read         -> 201 {"success":true,"unreadCount":3}
GET /api/notifications                    -> unreadCount 3, that item read=true
GET /api/notifications?unreadOnly=true    -> 3 items, the marked one gone
POST /api/notifications/<same id>/read    -> 201 {"success":true,"unreadCount":3}   (unchanged)
POST /api/notifications/read-all          -> 201 {"success":true,"unreadCount":0}
GET /api/notifications                    -> unreadCount 0, 0 unread rows
GET /api/notifications?unreadOnly=true    -> 0 items
```

**The two routes**

```
Mapped {/api/notifications/read-all, POST} route
Mapped {/api/notifications/:id/read, POST} route
```

Declared in that order. A test pins it by reading the `path` metadata Nest itself uses off the
prototype and asserting `read-all` precedes `:id/read` in the class body — the same guard the
student-verification controller has for `GET /student-verifications/me`. This is the second place a
parameterised route could shadow a literal one.

**Unit tests**

```
notifications.controller.spec.ts (B6 read state)
  ✓ marks one notification read and answers with the remaining unread count
  ✓ answers 404 for a notification the caller does not own
  ✓ marks the whole inbox read and answers unreadCount 0
  ✓ refuses both writes without an authenticated caller
  ✓ declares the literal read-all route before the parameterised one

sql-notification-management.spec.ts (read state (B6))
  ✓ marks one owned row read in a single ownership-scoped UPDATE, then reports the count
  ✓ reports null when the row belongs to somebody else, and counts nothing
  ✓ treats a second mark of the same row as still successful
  ✓ clears the whole inbox with one statement and no second query

mobile-notifications.spec.ts
  ✓ accepts the shape both mark-read routes answer with
  ✓ rejects a failure envelope, a negative count and a fractional count
```

## Decisions recorded

1. **`markRead` returns `number | null`, not a boolean.** Both routes have to answer with the
   remaining unread count anyway, so the count is what the port returns; `null` is the distinct
   "you own no such row" signal the controller turns into 404. A boolean plus a separate count call
   would be two round trips for one user action.
2. **Idempotent by construction.** `SET "read" = true` on an already-read row matches the WHERE and
   returns the id, so a second mark is `200` with the unchanged count. Nothing throws on a re-tap,
   which matters because the UI can double-fire a tap.
3. **`markAllRead` returns `0` without a count query.** It is 0 by construction — every unread row
   owned by the caller was just flipped — so the second query would only prove the write it just
   did.
4. **404, never 403, for a foreign or unknown id.** 403 would confirm the notification exists.
5. **`read-all` is declared before `:id/read`.** Nest matches in declaration order; the literal has
   to come first or it is unreachable. The guard is a test rather than a comment because a future
   edit that moves the method would otherwise silently break the route.
6. **The demo seed still writes no notifications.** They only exist when an event produces them, so
   the runtime probe drove the real pipeline (a teacher cancellation and two booking settlements)
   instead of inserting rows. That also proved the write side and the read side agree on the row
   ids.

## Gates

- `pnpm verify` — green: lint (`--max-warnings=0`), build, typecheck, all suites, depcruise
  1009 modules / 2925 dependencies, 0 violations
- `@skillswap/api` — 156 suites, 1036 tests (was 1028; +8)
- `@skillswap/contracts` — 11 suites, 238 tests (was 234; +4)
- `@skillswap/mobile` — 35 suites, 261 tests
- `@skillswap/web` — 51 files, 420 tests
- `docs/api/notifications.md` regenerated — 5 endpoints
