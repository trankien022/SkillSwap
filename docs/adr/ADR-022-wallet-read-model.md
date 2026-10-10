# ADR-022: Wallet read model — balance and history

- **Status:** Accepted
- **Level:** Software (C4 Level 3 · Component)
- **Date:** 2026-10-10

**Context.** FR-010 lets a user see their balance and a traceable history of every credit change (top-ups, payments, income, fees, reversals). The write side is done: `wallets` holds `available_credits`/`pending_credits` and `ledger_entries` records each mutation with `entry_type`, `direction`, `amount_credits`, `reference_id` and `trace_id` (ADR-017/ADR-018). `GET /api/wallet/balance` already exists from FR-008; there is no history read, and the display mapping has not been fixed.

The open items (OQ-005 account state, OQ-006 pending vs available, OQ-011 top-up representation) are resolved for their write-side scopes; this decision fixes the **read model**: what a user may see, how internal states are presented, and how the history is paged.

**Decision.**

1. **Owner-scoped only.** Balance and history are always scoped to the authenticated owner (`owner_id = current identity`). There is no cross-user read and no admin-wide view in the MVP; a request can never name another owner.
2. **Balance is authoritative and reconciled.** Balance is read from `wallets`, and the history is derived from `ledger_entries` for the same owner. `available_credits == sum(credit) − sum(debit)` over that owner's entries (see §Reconciliation); a mismatch is a bug, surfaced by a throwaway reconciliation check in tests.
3. **Display status vocabulary.** The read model exposes a small, stable display status that never implies a completed settlement for a non-final entry:
   - `completed` — a settled effect that changed the balance (`top_up`, `learner_debit`, `teacher_pending`, `platform_fee`, `teacher_credit`, `release`) once applied.
   - `reversed` — an entry that was reversed (`reversal`, `refund`).
   Failures that never touched the ledger (a `failed` top-up) simply have **no entry** and therefore never appear as completed. Pending (unsettled) top-ups are not ledger entries either and are excluded from history in the MVP.
4. **Display item shape.** History items expose `{ id, type, direction, amountCredits, status, reference?, createdAt }`. `type` is the entry type; `direction` is `credit|debit`; `amountCredits` is the integer magnitude (never signed, never a float). Technical ids (`traceId`, provider refs) are **not** exposed to users; a `reference` (opaque, already public in context) may be included when it belongs to the module.
5. **Pagination.** History is **cursor-paginated** by `(created_at, id)` descending with a bounded page size; there is no offset paging and no full-history export in the MVP.

**Rationale.** Reusing the ledger as the single source of truth keeps balance and history consistent by construction and avoids a second read model. A tiny display-status vocabulary prevents the AC-019/AC-010 class of bugs (showing pending/failed/reversed as completed) while keeping the internal `entry_type` vocabulary free to grow. Cursor paging on an append-only table is stable under inserts, unlike offset paging. Hiding trace/provider ids keeps internal plumbing out of the user's view.

**Consequences.**

- (+) A user's history provably matches their balance; one owner-scoped read path.
- (+) No non-final state is ever rendered as completed.
- (−) Pending top-ups and failed attempts are invisible in the MVP history (a follow-up can surface them from `top_up_intents`).
- (−) The display status is derived, not stored; new entry types must be mapped explicitly.

**Verification.** Unit: balance+history are owner-scoped; an outsider id can never be read; a reversal/refund shows `reversed` and never `completed`; cursor paging is stable. Integration: sum of history equals the balance. Architecture tests stay green.
