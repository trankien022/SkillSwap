---
title: End-to-end transaction trace
type: runbook
date: 2026-10-26
topic: nfr-003-nfr-005-trace
status: Written from a real transaction; the defect it found is fixed
owner: Group 4
---

# End-to-end transaction trace (NFR-003, NFR-005)

SRS §3.6 asks to "trace one sample transaction through gateway → API → ledger", and RFC 3.5 (Auditability) says privileged and financial actions are audited with actor, timestamp and trace ID. This runbook does that literally, on a running stack, and records what the ids actually do.

It exists because "we carry a trace id" and "the ids join up" are different claims, and only the second one is worth anything during an incident.

---

## What to trace

The MVP's financial events are:

| Event | Producer | Ledger `entry_type` | Emits `wallet.transaction.completed`? |
|---|---|---|---|
| Wallet top-up settled | `HandleTopUpCallbackUseCase` → `SqlWalletRepository.applyTopUp` | `top_up` | **yes** (fixed 2026-10-26, see below) |
| Top-up reversed | same, `direction: 'debit'` | `reversal` | **no** — see *Open gaps* |
| Booking payment (hold → debit) | `SettleBookingRequest` → `settleBooking` | `learner_debit`, `teacher_pending`, `platform_fee` | yes |
| Booking refund | `refundBooking` | `refund` | not emitted |
| Income release | `releaseIncome` | `release` | not emitted |

A top-up is the best sample: it crosses the gateway, the payment provider's IPN, two tables and an outbox event, and it is reproducible locally without a real bank.

The amount is priced by `VND_PER_CREDIT` (default 1,000, BR-027 / decision D3), and each intent stores the rate it was priced at in `top_up_intents.vnd_per_credit`. When reading a trace, trust that column rather than the current configuration: the configuration says what a *new* top-up would cost, the column says what this one did.


---

## Procedure

1. **Start the stack and seed.** `pnpm db:up && pnpm db:migrate && node scripts/seed-demo.mjs`, then `pnpm -r --parallel dev`. The trace below is against gateway `:4000` — going straight to `:4001` returns `401`, because the gateway is what terminates the session.

2. **Sign in** as any demo user (`Demo1234!`) and keep the access token.

3. **Start a top-up.** `POST /api/wallet/top-ups { amountVnd: 50000 }`. The response carries `id` (the intent) and `providerRef` (our invoice number, `SS-…`) — *not* a trace id. The trace is minted later, at settlement.

4. **Deliver the provider IPN.** `POST /api/wallet/top-ups/callback` with a SePay `ORDER_PAID` body whose `order.order_invoice_number` is the `providerRef`. The shape lives in `apps/api/test/room-idle-payment.e2e-spec.ts` (`sepayIpn`).

5. **Read the four rows that must agree.** Each query below is copy-pasteable against the local container (`docker exec -i skillswap-postgres psql -U postgres -d skillswap`).

```sql
-- 1. the intent: our reference and the provider's, and what was actually paid
SELECT id, provider_ref, status, amount_vnd, amount_credits, vnd_per_credit, paid_amount_vnd, paid_at
  FROM wallet_ledger.top_up_intents
 WHERE provider_ref = 'SS-…';

-- 2. the ledger row: the durable identity, and the trace id minted at settlement
SELECT id, entry_type, direction, amount_credits, reference_id, trace_id
  FROM wallet_ledger.ledger_entries
 WHERE entry_type = 'top_up' AND reference_id = '<intent id>';

-- 3. the outbox event: transactionId must equal the ledger id from step 2
SELECT event_type, status, aggregate_id, sequence, payload
  FROM wallet_ledger.outbox_messages
 WHERE payload->>'transactionId' = '<ledger id>';

-- 4. the wallet balance the credit landed on
SELECT owner_id, available_credits, pending_credits
  FROM wallet_ledger.wallets WHERE owner_id = '<owner id>';
```

6. **Read the consumer's outcome.** `account-profile.notification-wallet-completed` turns the event into an inbox row:

```sql
SELECT event_id, account_id, type, target_type, target_id
  FROM account_profile.inbox_notifications
 WHERE account_id = '<owner id>' AND type = 'wallet_transaction';
```

---

## A real trace (2026-10-26)

Produced on the local stack, quoted verbatim so a later reader can tell a worked example from a template.

| Step | Identifier | Value |
|---|---|---|
| Intent | `top_up_intents.id` | `f92510fd-80b3-4438-8e6f-3191508ae5f7` |
| Our invoice | `provider_ref` | `SS-1792998757545-6FD31E` |
| Owner | `owner_id` | `59f5515a-9125-415d-95e4-9bcd7b55787e` |
| Ledger row | `ledger_entries.id` (`entry_type = top_up`) | `3045` |
| Trace | `ledger_entries.trace_id` | `1b4c66c2-ba1d-4cfc-ad12-7b30c3849a5d` |
| Balance | `wallets.available_credits` | 500 → 550 (50 credits for 50,000 VND) |
| Outbox | `outbox_messages` for this account | **0 rows at the time of tracing** |

### The finding

The ledger row carried a trace id, the balance moved, the intent reached `settled` — and the outbox was **empty**. `SqlWalletRepository.applyTopUp` wrote the ledger entry and the balance in one transaction and then stopped. Only `settleBooking` emitted `wallet.transaction.completed`.

The consequence was not cosmetic. `account-profile` registers a consumer for that event (`notification-wallet-completed`, FR-016 lists "completed wallet transactions" among the notifications owed), so **a learner's money arrived without the notification that says it arrived**. Nothing was broken in a way any test noticed: every settlement test looked at the booking path, and every top-up test looked at the ledger.

Fixed 2026-10-26. `applyTopUp` now writes ledger → balance → outbox event in the one transaction, with the event's `transactionId` set to the inserted ledger id — the same durable identity `settleBooking` uses, so a consumer can always follow the event back to the money. Guarded by three unit tests (emitted, silent on reversal, rolled back when the event cannot be written) and two E2E tests against the real database (one event for a settled top-up; still exactly one after a replayed IPN).

### The same trace after the fix

Re-run on the local stack, signed in as `user3@demo.skillswap.local`, 30,000 VND = 30 credits:

| Step | Value |
|---|---|
| Intent | `358754d1-8679-4e95-9357-649a92a81a35` |
| `provider_ref` | `SS-1792999449880-D30153` |
| Ledger row (`top_up`) | `3089`, `trace_id` `b3818850-95ce-46a7-a3f1-80ce0b7f5622` |
| Outbox | `wallet.transaction.completed`, status `PUBLISHED`, `sequence` 0, `transactionId` `3089` |
| Actor | `00000000-0000-4000-8000-000000000000` (`SYSTEM_ACTOR_ID`) |
| Consumer outcome | `inbox_notifications` row, type `wallet_transaction`, `target_id` `3089` |
| Balance | 1,000 → 1,030 credits |

The chain now closes: **intent → ledger id → event → inbox row, all keyed on `3089`.** That is the property NFR-003/NFR-005 is asking for, and it is checkable by hand in four queries.

### The rate snapshot, checked at a non-default rate (D3)

Default-rate runs only prove the column is written. Restarting the API with `VND_PER_CREDIT=500` proves the *configured* value is the one that prices the money:

| Run | `VND_PER_CREDIT` | 100,000 VND produced | Stored `vnd_per_credit` |
|---|---|---|---|
| Default | (unset → 1000) | 100 credits | 1000 |
| Verification | 500 | **200 credits** | **500** |

`amount_credits = amount_vnd / vnd_per_credit` held in both rows, and the check constraint refused a `vnd_per_credit` of 0 in a deliberately rolled-back transaction. The 500 run was a verification; the default was restored afterwards.

---

## Open gaps (recorded, not silently dropped)

These are honest incompletenesses rather than defects found today. Each is a small, named scope.

1. **A reversal announces nothing.** `walletTransactionCompletedEventSchema.type` has no reversal member (`top_up`, `booking_payment`, `booking_refund`, `income_release`, `platform_fee`), so `applyTopUp` with `direction: 'debit'` writes the ledger row and stays quiet. In this release an invoice number produces at most one settlement and nothing emits a reversal, so the path is unreachable; adding an event type is a contract change that belongs to whoever first needs it. **Not invented here.**
2. **Refunds and income releases emit no `wallet.transaction.completed`.** Both move money and both are silent. Same judgement as above: they need a decision about what a user is told, not a default.
3. **Top-up trace ids are per-settlement, not per-request.** `HandleTopUpCallbackUseCase` mints a fresh `randomUUID()` for `traceId` on each `applyTopUp` call, so the trace identifies the money movement, not the HTTP request that caused it — and the id is not present in any response the caller sees. Joining "the IPN request" to "the ledger row" therefore still relies on `provider_ref`.
4. **Nothing is written to `admin_operation.admin_audit_event` for a top-up.** A SePay IPN is not a human act (`SYSTEM_ACTOR_ID`), and ADR-034 §5 scopes auditing to claims and decisions, so this is consistent with the decision — but it means the audit log is not the place to look for a payment.

Gaps 1–2 are the same shape: the event schema was built for the booking flow and the top-up flow was added beside it. Whoever extends the contract should extend all three producers in one change.
