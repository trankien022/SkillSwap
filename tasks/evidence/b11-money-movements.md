# B11 evidence — money that moves now says so

Task: B11 in `2026-11-07-backend-remaining-work.md`. Runbook: `docs/runbooks/transaction-trace.md`.
Date: 2026-11-08. Branch `feat/backend-remaining-work-and-client-fixes`.

## What B11 was, and what it turned out to be

The runbook listed four gaps. Three were real: a booking refund, an income release and a top-up
reversal each moved money and emitted nothing, so a user's balance changed with no inbox row to say
why. The fourth (no audit row for a top-up) was **stale** — it already worked, and this phase did not
build it.

Scope therefore: three producers plus one contract member, not four producers.

## 1. The stale gap, disproved before any code was written

The plan assumed `admin-operation` had no consumer for `wallet.transaction.completed`. It does.
`audit-actions.ts` has carried `walletTransactionCompleted: 'wallet.transaction.completed'` since
PR #93, and the consumer row exists in `admin-operation`'s registrar.

A live top-up on the running stack produced:

```
actor_id   | 00000000-0000-4000-8000-000000000000
action     | wallet.transaction.completed
target_type| wallet_transaction
target_id  | 4431
new_state  | {"type": "top_up", "direction": "credit", "amountCredits": 30}
```

So the runbook was wrong, not the code. Rather than build a duplicate consumer, the runbook was
corrected and the gap re-pointed at what is genuinely missing: **initiation** is unaudited, settlement
is not. Recorded in the runbook's gap 1 with the date and the reason.

## 2. The three producers

All three now write ledger row → balance → outbox event in **one transaction**, with
`transactionId` = the inserted ledger id, matching `settleBooking`'s existing shape.

| Path | `type` | direction | keyed on | actor |
|---|---|---|---|---|
| `refundBooking` | `booking_refund` | `credit` | refund ledger id, `bookingId` correlated | `SYSTEM_ACTOR_ID` |
| `releaseIncome` | `income_release` | `credit` | release ledger id, `bookingId` correlated | `SYSTEM_ACTOR_ID` |
| `applyTopUp` (debit) | `reversal` | `debit` | reversal ledger id, no `bookingId` | `SYSTEM_ACTOR_ID` |

`actorId` is threaded through the request ports from the use cases rather than imported inside the
repository, following the `SettleBookingRequest` precedent — the wallet module does not decide who
the actor was. The beneficiary (`learnerId`, `teacherId`) is a separate field and stays distinct
(ADR-035): the teacher was paid, the system released.

The idempotent paths stay silent. A replayed `class.completed` hits `ON CONFLICT DO NOTHING` and
returns before the insert; a second `booking.cancelled` for an already-refunded booking returns
`applied: false` before any write.

## 3. Contract: the `reversal` member

`walletTransactionCompletedEventSchema` gained `'reversal'` and a refinement `reversal → direction:
'debit'`, mirroring `booking_payment`. This is the member the runbook had explicitly declined to
invent: with no producer, a type would have been a contract with nothing behind it. `sepay-ipn.ts`
mapping `TRANSACTION_VOID` to a reversal is that producer, so the member now earns its place.

The direction rule is load-bearing, not decoration: the inbox copy is chosen by `type`, so a reversal
announced as a credit would reach the learner's screen saying money arrived.

Existing members and rules are untouched, and a test parses all five earlier types so a typo in the
enum fails there.

## 4. Live probe (running stack, real Postgres, real broker)

Script: `b11-probe.mjs`. Values are from the run on 2026-11-08; ids regenerate on each reseed.

### Reversal

| Step | Result |
|---|---|
| Balance before | `{availableCredits: 500, pendingCredits: 0}` |
| Top-up intent + `ORDER_PAID` IPN | 200, balance `{530, 0}` |
| Same invoice, `TRANSACTION_VOID` IPN | 200, balance `{500, 0}` |

`ORDER_REFUNDED` was tried first and produced HTTP 200 with **no** state change — `sepay-ipn.ts`
recognises only `TRANSACTION_VOID` as a reversal. That is now stated in the runbook rather than left
as a trap.

Afterwards, in `wallet_ledger.outbox_messages`:

```
tx_type   | reversal
direction | debit
amount    | 30
account   | 1cf2cc02-83d1-480c-9b07-5f530ea2b74e
booking   | (empty)
tx_id     | 4438
actor     | 00000000-0000-4000-8000-000000000000
aggregate | 1cf2cc02-83d1-480c-9b07-5f530ea2b74e
sequence  | 5
```

`sequence` continues the account's own series (top-up was 4), because a top-up and its reversal share
the `accountId` aggregate and `insertOutboxStatement` derives it that way.

### Refund

Class created (100 credits), booked, confirmed, then cancelled by the teacher:

| Step | Result |
|---|---|
| Learner balance | `1680` → debit 100 → `1580` → refund → `1680` |
| Cancel response | `{"classCancelled": true, "bookingsCancelled": 1}` |

```
tx_type   | booking_refund
direction | credit
amount    | 100
account   | a63b41ca-e900-472e-9e83-42634abdc131   (the learner: beneficiary)
booking   | dff14d7a-0f91-4c44-8329-dc78635f2d08
tx_id     | 4446
actor     | 00000000-0000-4000-8000-000000000000
sequence  | 1
```

Sequence 0 on that aggregate was the `booking_payment`; the refund correctly follows it.

### Income release

Class created, booked, confirmed, then `starts_at` aged two hours via SQL so the real completion
sweeper would close it. The sweeper runs on a 60 s timer, so the probe waited rather than calling the
use case directly — this is the production path.

| Step | Result |
|---|---|
| Class state | `published` → `completed`, `completion_basis = scheduled_end` |
| Teacher balance | `500` available, `0` pending → `590` available after the release |
| Ledger row | id `4447`, `entry_type = release`, `release_key = class-completed:fde7a68f-…`, 90 credits |

```
tx_type   | income_release
direction | credit
amount    | 90
account   | 1cf2cc02-83d1-480c-9b07-5f530ea2b74e   (the teacher: beneficiary)
booking   | d943b352-ec55-4aab-83f0-5378961cc170
tx_id     | 4447
actor     | 00000000-0000-4000-8000-000000000000
sequence  | 1
```

## 5. The chain closes, read back from three tables

Ledger rows for the probe:

```
id   | entry_type    | direction | amount | reference_id                         | release_key
4437 | top_up        | credit    |     30 | 6ea45877-e891-40f1-9f55-0d88bc49e37e |
4438 | reversal      | debit     |     30 | 6ea45877-e891-40f1-9f55-0d88bc49e37e |
4440 | learner_debit | debit     |    100 | dff14d7a-0f91-4c44-8329-dc78635f2d08 |
4443 | learner_debit | debit     |    100 | d943b352-ec55-4aab-83f0-5378961cc170 |
4446 | refund        | credit    |    100 | dff14d7a-0f91-4c44-8329-dc78635f2d08 |
4447 | release       | credit    |     90 | d943b352-ec55-4aab-83f0-5378961cc170 | class-completed:fde7a68f-…
```

Audit rows, one per event, `target_id` = the ledger id:

```
target_id | new_state
4447      | {"type": "income_release", "direction": "credit", "amountCredits": 90}
4446      | {"type": "booking_refund", "direction": "credit", "amountCredits": 100}
4443      | {"type": "booking_payment", "direction": "debit", "amountCredits": 100}
4440      | {"type": "booking_payment", "direction": "debit", "amountCredits": 100}
4439      | {"type": "top_up", "direction": "credit", "amountCredits": 300}
4438      | {"type": "reversal", "direction": "debit", "amountCredits": 30}
4437      | {"type": "top_up", "direction": "credit", "amountCredits": 30}
```

Inbox notifications, one per event:

```
account    | type               | title              | at
1cf2cc02…  | wallet_transaction | Wallet updated     | 03:29:13   (income_release)
a63b41ca…  | wallet_transaction | Wallet updated     | 03:28:28   (booking_refund)
a63b41ca…  | wallet_transaction | Wallet updated     | 03:28:28   (booking_payment)
1cf2cc02…  | wallet_transaction | Wallet updated     | 03:28:26   (reversal)
```

Three tables agree on the same ids, which is the property NFR-003/NFR-005 asks for.

## 6. Replay does not duplicate

The same `TRANSACTION_VOID` was delivered two more times (SePay retries when it does not get a 200).
Counts, before and after:

```
                 | reversal_ledger | reversal_events | wallet_notifications | wallet_audits
before replay    |               3 |               3 |                   14 |            14
after 2 replays  |               3 |               3 |                   14 |            14
```

Both replays returned `{"success": true}` with no change to any of the four. The intent's status can
only advance once, so `applyTopUp` is not reached a second time — the guarantee lives in the state
machine, and the outbox only ever sees the movement that happened.

## 7. Money must not move without its announcement

Unit tests assert the rollback on each of the three paths: if the outbox insert throws, the ledger
row and the balance write in the same transaction are undone and the call rejects.

- `applyTopUp` debit — `rolls the credit back when the event cannot be written` (existing, still green)
- `releaseIncome` — `rolls the whole release back when the event cannot be written`
- `refundBooking` — `rolls the whole refund back when the event cannot be written`

## 8. Gates

| Gate | Result |
|---|---|
| `pnpm verify` | exit 0 (lint, build, typecheck, tests, arch rules) |
| `apps/api` wallet-ledger tests | 134 passing across the module |
| `packages/contracts` tests | 244 passing |
| Float money | `git grep -nE "parseFloat\|toFixed.*[Pp]rice" -- apps/api/src` — no new hits; the only `parseFloat` is SePay's provider amount parser, which converts to integer VND via `Math.round` |

## Deviations from the plan, recorded

1. **The top-up audit consumer was not built**, because it already exists. Building it would have
   produced a duplicate audit row per top-up. The plan's table row is struck through with the reason.
2. **`actorId` was added to two ports.** The plan said "thread `actorId` into `ReleaseIncomeRequest`
   and `RefundBookingRequest`", and this is what was done — but it is worth naming that this widens
   two interfaces rather than only adding emitters. The alternative (importing `SYSTEM_ACTOR_ID`
   inside the repository) would have moved an audit decision into the adapter, contradicting the
   precedent `SettleBookingRequest` set.
3. **Historical rows are not backfilled.** A refund that happened before this commit stays silent.
   The money already moved; announcing it retroactively would tell users about events they have
   already reconciled. Documented in the runbook.
