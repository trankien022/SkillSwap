# B7 — the inbox speaks the reader's language

Date: 2026-11-07
Task: B7 of `../../../2026-11-07-backend-remaining-work.md`

## What was wrong

The same event reached the same person in two languages. Push already localised: the delivery store
carries `notification_devices.locale` per installation and `PushDeliveryWorker` renders
`notificationCopy(type, delivery.locale ?? 'vi')`. But the inbox row was written once, at consume
time, with a private English-only `switch` inside `sql-notification-management.ts`:

```ts
function notificationCopy(type: RecordInboxNotification['type']) {
  case 'booking_cancelled': return { title: 'Class booking updated', ... };
  ...
}
```

So one `class.cancelled` event produced a Vietnamese push and an English inbox row for the same
Vietnamese user — and the row stayed English forever, in whichever language the writer happened to
have compiled in.

Seen live before the fix:

```
GET /api/notifications  ->  booking_cancelled  title="Class booking updated"
```

## What changed

| File | Change |
|---|---|
| `adapter/out/persistence/sql-notification-management.ts` | the private English `switch` is **gone**; `list()` resolves `title`/`body` per read through the shared `notificationCopy(type, locale)`. New private `readLocale(accountId)` picks the account's most recently updated **active** device |
| same file, `recordInboxNotification` | still fills the NOT NULL columns, now with `notificationCopy(type, 'en')` from the **same** shared function — one copy table, no second switch |
| `adapter/out/persistence/notification-copy-parity.spec.ts` (new) | push text and inbox text asserted equal, both through real implementations |
| `adapter/out/persistence/sql-notification-management.spec.ts` | read-time copy cases |

No migration. The `title`/`body` columns stay (the task says not to drop them in this phase), and
after the change nothing writes them wrong: they hold the `en` copy, which is exactly what the
`en` reader would have received anyway.

## Evidence

**The two named cases, one stored row, through the gateway**

```
POST /api/notification-devices {locale:'vi'}   -> 201
GET  /api/notifications -> booking_confirmed   title "Đặt lớp thành công"
                                               body  "Lớp bạn đặt đã được xác nhận. Mở lịch học để xem chi tiết."

POST /api/notification-devices {locale:'en'}   -> 201
GET  /api/notifications -> booking_confirmed   title "Booking confirmed"
                                               body  "Your class booking is confirmed. Open your schedule to view the details."
```

**What the database actually holds** — the write-time fallback the reader must *not* render:

```
        type        |   stored_title    |                stored_body
--------------------+-------------------+---------------------------------------------
 booking_confirmed  | Booking confirmed | Your class booking is confirmed. Open your sch
 booking_confirmed  | Booking confirmed | Your class booking is confirmed. Open your sch
 wallet_transaction | Wallet updated    | A wallet transaction completed. Open your wall
```

The rows did not change between those two `GET`s. Only the reader's device did.

**The account's language is decided per read, from its newest active device**

```
user7 registers 'vi' then 'en'   -> GET returns English
user7 registers 'vi' again       -> GET returns Vietnamese   (same rows, newest device wins)
user10, 'vi' only                -> GET returns Vietnamese   while user7 reads English
```

Every row on the page is localised, not just `booking_cancelled`:

```
booking_confirmed    "Đặt lớp thành công"
wallet_transaction   "Cập nhật ví"
booking_confirmed    "Đặt lớp thành công"
wallet_transaction   "Cập nhật ví"
booking_cancelled    "Lớp học đã hủy"
```

**Both grep boxes from the task**

```
$ grep "function notificationCopy" apps/api/src
apps/api/src/modules/account-profile/internal/application/notification-copy.ts:2

$ grep "Class booking updated" apps/api/src
.../adapter/out/push/expo-push-provider.spec.ts:10:      to: 'ExponentPushToken[test]', title: 'Class booking updated', ...
.../application/push-delivery-worker.spec.ts:8:  token: 'ExponentPushToken[test]', type: 'booking_cancelled', title: 'Class booking updated',
```

One production `notificationCopy`; the dead English string survives only in two test fixtures that
never exercise the copy path.

**Unit tests**

```
notification-copy-parity.spec.ts (push and inbox agree on the copy (B7))
  ✓ sends and lists the same Vietnamese strings
  ✓ sends and lists the same English strings
  ✓ agrees on the Vietnamese default when neither side knows a language

sql-notification-management.spec.ts (read-time copy (B7))
  ✓ renders Vietnamese for an account whose active device is vi
  ✓ renders English for an account whose active device is en
  ✓ defaults to Vietnamese when the account has no active device
  ✓ ignores a device locale that is not one of the two supported languages
  ✓ renders every contract notification type in both languages, with no stored text leaking
```

The parity test wires the **real** worker and the **real** SQL adapter, with the stored columns set
to the sentinel `STORED` / `STORED`. It fails if either side grows its own copy table, and it fails
if the reader ever falls back to the columns for a type that has copy. That is the box the task
words as "push text and inbox text are identical for the same event".

## Decisions recorded

1. **The read decides the language, not the write.** A notification row has no language: it has a
   type. Whoever reads it brings the language. This is the only shape under which one event can
   serve a Vietnamese phone and an English laptop, and it is why the `switch` had to go rather than
   be extended with a second language.
2. **"The account's language" is its most recently updated active device.** The inbox read has no
   device context — the JWT identifies an account, not an installation. Rather than add a locale
   header or a query parameter (which every client would have to start sending), the account speaks
   with the device it used last, ordered by `updated_at DESC, id DESC` for a stable tie-break. A
   per-installation inbox would be a different product.
3. **No device means `vi`.** That is the same default `notification_devices.locale` carries, so a
   user who never registered a device cannot get an inbox in a language their own device disagrees
   with. It matches the push path's `?? 'vi'` too.
4. **An unrecognised locale reads `vi`, not the raw string.** Anything that is not the exact `en`
   falls back to the default; a future `fr` device would otherwise index into a copy table that has
   no French.
5. **The columns are written with the shared `en` copy and kept.** The task defers dropping them.
   Filling them through `notificationCopy` instead of a private switch means there is one place
   where a type's wording can change, and the write-time text a future reader might fall back to is
   the English copy rather than a fourth variant.
6. **The `en` fallback in the chain is unreachable today and kept anyway.** `notificationCopy`
   returns `undefined` only for a type outside the six-member contract enum, which the DB `CHECK`
   and the response schema both reject — so no valid row can reach it. It stays because the columns
   are NOT NULL and a future type must not render `undefined` into them.
7. **The write side is not a "fallback" in disguise.** `recordInboxNotification` runs once, at
   consume time, before any reader exists. It is not choosing a language; it is satisfying a
   constraint. The comment in the code says so, because a future reader of that line could
   reasonably think the language was still being decided there.

## Gap found, out of this phase's scope

`GET /api/notifications?unreadOnly=false` returns **only unread** rows. `listNotificationsQuerySchema`
uses `z.coerce.boolean()`, and `Boolean('false')` is `true`, so the string never means false. It is
pre-existing and unrelated to B6/B7 (both of which only need `unreadOnly=true`), and the mobile
client only sends the parameter when it is truthy — so no shipped client is wrong. Recorded here
rather than silently changed, because it is a separate contract fix with its own blast radius.

## Gates

- `pnpm verify` — green: lint (`--max-warnings=0`), build, typecheck, all suites, depcruise
  1010 modules / 2933 dependencies, 0 violations
- `@skillswap/api` — 157 suites, 1045 tests (was 1036; +9)
- `@skillswap/contracts` — 11 suites, 238 tests
- `@skillswap/mobile` — 35 suites, 261 tests
- `@skillswap/web` — 51 files, 420 tests
- `docs/api/` regenerated — no change (no wire schema changed)
