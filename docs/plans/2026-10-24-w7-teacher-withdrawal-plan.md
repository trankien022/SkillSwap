---
title: W7 — Teacher withdrawal (FR-014)
type: plan
date: 2026-10-24
topic: w7-teacher-withdrawal
status: Deferred out of the MVP — no payout rail (decided 2026-10-25)
owner: Group 4
---

# W7 — Teacher withdrawal

**Parent:** [`2026-10-24-fr-completion-master-plan.md`](2026-10-24-fr-completion-master-plan.md)
**FRs:** FR-014 (Must) · **ACs:** AC-008, AC-013, AC-014, AC-015 (release idempotency) · **UC:** UC-005 · **BRs:** SR-BR-005, SR-BR-006, SR-BR-012
**Modules:** `wallet-ledger` (primary), `account-profile` (notification), `admin-operation` (audit)
**Priority:** P3 — **deferred out of the MVP (2026-10-25): no payout rail exists.** Only a docs obligation remains; phases 1–7 are retained as a design record.

---

## 0. Current state

| Piece | Reality |
|---|---|
| Endpoint | **None.** `wallet.controller.ts` has top-ups, balance, history. No withdrawal route. |
| Use case / port / repository | **None.** No `WithdrawalRequest` anywhere in `apps/api`. |
| Ledger buckets | `payout_hold` exists in `domain/wallet.ts` and in the ledger schema; `wallet.spec.ts:35` even tests "allows withdrawals only from an active wallet" — a rule with no operation behind it. |
| UI | Web `/{locale}/wallet/withdrawal` renders an **honest "unavailable"** panel (deliberate, per SRS Appendix D S11). `wallet/page.tsx:239` and `instructor/page.tsx:268` both link to it — the product advertises a door that will now stay shut for this release. |
| Notification type | `withdrawal_outcome` declared in `notification-copy.ts`, the DB `CHECK`, and the port union. No producer — and **none will be added this release**. |
| Audit | no withdrawal event |

The ledger mechanics are **already decided**: ADR-018 (hold/payout/release, exactly once), ADR-033 (gateway port), OQ-012 (integer rounding). **What is missing is the payout leg of the gateway, and the Product Owner decided not to substitute a manual one.**

> **Decision (2026-10-25):** withdrawal is **out of the MVP**. FR-014 is a `Must`, so under the ✅27 rule it is **amended in the SRS with a stated reason**, not left looking implemented. The reason is concrete: there is no provider payout rail, and paying teachers through an admin's out-of-band transfer would mean the ledger's "paid" status records something the ledger cannot verify — a false state in the money trail, which is worse than an absent feature.

---

## Phase 0 — Conflict resolution gate (**developer interference required**)

> **STOP (gate closed 2026-10-25 — this wave is OUT of the MVP).** The Product Owner decided to **wait for a real provider payout API** rather than fake one, and confirmed there is **no withdrawal fee** because the 10% commission is already the platform's cut. Consequently **no withdrawal code is written in this MVP**. What remains is a docs obligation, recorded below.

| # | Conflict | Rules in tension | Decision owner | Blocking? | How it is closed |
|---|---|---|---|---|---|
| **C1** | **OQ-005 — limits, fees, SLA, eligibility** | FR-014 core vs. OQ-005 resolved only for top-up | **Product Owner + Finance** | **CLOSED 2026-10-25** — **no fee** (the 10% commission covers the platform); limits become moot for the MVP because withdrawal does not ship | Recorded for whenever withdrawal returns — **limits must be re-decided then**, they are not inferred here |
| **C2** | **OQ-011 — is there a payout rail?** | FR-014 reserve → payout → release vs. OQ-011 resolved only for top-up (ADR-033) | **Engineering + Finance** | **CLOSED 2026-10-25 — no rail yet; wait for a real payout API.** N1 only | **No manual-fulfilment mode, no fake "paid" status** |
| C3 | **BR-027 configurable rate** | BR-027 vs. `VND_PER_CREDIT = 1000` hardcoded (`wallet.ts:4`) | Engineering + Finance | **Still a real gap** | Becomes **top-up-only** now. Move to config and snapshot per request — a separate small fix, tracked under W9 |
| C4 | **Is timeout a failure or an unknown?** | BR-033 vs. ADR-018 | Engineering + Finance | Closed (n/a this MVP) | Unknown ≠ failed. Recorded for the future implementation |
| C5 | **BR-038 — pending income not withdrawable** | BR-038 vs. the wallet UI | Product Owner + Engineering | Moot for MVP | `/wallet` already separates available from pending; nothing to change |
| C6 | **NFR-009 step-up auth does not exist** | NFR-009 vs. no MFA | **Product Owner** | **CLOSED 2026-10-25** — MFA removed (W9 D8b); and payouts do not ship | When withdrawal returns it needs **both** a rail and an auth control — recorded as a precondition |
| C7 | **BR-069 — no cash conversion outside the official flow** | BR-069 vs. manual fulfilment | Product Owner + Finance | Moot — manual fulfilment is not adopted | The official ledger flow remains the only path once withdrawal lands |
| C8 | **Mobile parity** | SRS Appendix D S11 | Product Owner | Moot for MVP | S11 stays an "unavailable" page, now with a stated reason |

**Exit criteria (revised):** the only work this wave owes the MVP is documentation:

1. SRS → FR-014 status becomes **`Deferred — out of MVP (no payout rail; OQ-011 open)`**, with the reason stated. This is the W9 ✅27 rule applied to a `Must` requirement: it is amended, not silently skipped.
2. SRS Appendix C.3 and §3.7 lose the "no withdrawal endpoint, so US-W4 cannot be exercised" **gap** framing and gain an explicit **scope exclusion**.
3. AC-008 / AC-013 / AC-014 are marked **deferred with FR-014**, not verified.
4. `docs/api/` and S11 copy stay as they are; the copy changes from "temporarily unavailable" to "not offered in this release".

**Commit:** `docs(srs): defer teacher withdrawal out of the MVP (no payout rail)`

> **Phases 1–7 below are retained as the design record for when a payout API exists.** They are **not to be implemented** under this decision. The phase text is kept so the work is not redesigned from scratch later, and so the limits/fee/auth questions are visibly still owed.

---

## Phase 1 — ADR-037 (on hold)

`ADR-037-teacher-withdrawal.md`, recording the Phase 0 answers plus:

1. The chosen fulfilment mode (N1/N2/N3) behind the unchanged `PaymentGateway` port.
2. `WithdrawalRequest` lifecycle: `pending → processing → completed | failed | reversed`, and that **timeout is not failure** (C4).
3. The auth control actually shipped — step-up (NFR-009) if it exists, otherwise **admin approval** as the stated compensating control (C6).
4. Reconciliation policy: an unknown result retains the hold indefinitely until an operator resolves it (no auto-release).
5. The manual-fulfilment mode is still the official ledger flow (C7, BR-069), so it cannot be read as an off-platform cash conversion.

**Commit:** `docs(adr): decide teacher withdrawal fulfilment`

---

## Phase 2 — Domain (after C1, C3)

`wallet-ledger/internal/domain/withdrawal.ts`:

- `assertWithdrawable({ wallet, amount, policy, now })` → active wallet, integer credits, `amount >= policy.min`, `amount <= policy.max`, `amount <= available` (**never `pending`** — BR-038/C5), per-day count, rate snapshot per BR-027/C3.
- `computeHold({ available, amount })` → `{ available: available - amount, payoutHold: payoutHold + amount }`, integers only.
- `assertOutcome(request, outcome)` → only a definitive outcome may post; replaying the same outcome is a no-op; conflicting outcomes after a terminal state are rejected (AC-014).
- `isTimeoutUnknown(result)` — unknown ≠ failed (BR-033/C4).

**Tests:** boundary amounts, insufficient, inactive wallet, **pending-only balance rejected**, double-outcome, replay, non-negative invariant, integer invariant (`AGENTS.md`: money is integer VND, never floats), rate snapshot immutability.

**Commit:** `feat(wallet-ledger): add withdrawal domain rules`

---

## Phase 3 — Persistence (after C2)

Per-module migration in `wallet-ledger`:

- `withdrawal_requests(id, teacher_id, amount_credits, exchange_rate_vnd, destination_ref, status, trace_id, created_at, decided_at, provider_ref)` — amount/rate/destination frozen at creation (SRS Appendix B).
- ledger transactions reference it via the existing `withdrawal_request_id` column in the data dictionary; if that column does not exist yet, add it.
- **`uq_withdrawal_open_per_provider_ref`** on a stable provider idempotency key, mirroring `uq_ledger_settlement_per_booking` (W1 Phase 2 pattern: lock first, key second).

**Commit:** `feat(wallet-ledger): persist withdrawal requests`

---

## Phase 4 — Use cases

1. `request-withdrawal.use-case.ts`: validate (Phase 2) → **one transaction**: create request + post hold posting + outbox `wallet.withdrawal.requested` → return the request. Commits **before** any gateway call (FR-014: "reserve atomically with the request").
2. `dispatch-withdrawal.use-case.ts` (N1 only): call the gateway with a stable provider key; on definite failure, post hold release + `failed`; on timeout, stay `processing` and keep the hold.
3. `decide-withdrawal.use-case.ts` (N2, admin): post payout (`payout_hold → system` credit-out) or hold release (`payout_hold → available`), set terminal status, emit `wallet.withdrawal.completed|failed` — exactly once, under a row lock.

**Tests (the ACs verbatim):**
- AC-013: available 100, withdraw 80 → available 20, hold 80; a second 80 rejected with no hold.
- AC-014: gateway timeout → hold stays 80; a later success callback posts payout once; no payout+release pair.
- AC-015 pattern: two different keys for one request release nothing twice.

**Commit(s):** `feat(wallet-ledger): request a teacher withdrawal` , `feat(wallet-ledger): settle a withdrawal outcome exactly once`

---

## Phase 5 — REST + admin

- `POST /wallet/withdrawals` (owner), `GET /wallet/withdrawals` (owner, paginated), `GET /wallet/withdrawals/:id`.
- N2: `POST /operations/withdrawals/:id/decision` (admin, audited — depends on W4 for actor).
- Envelope + response codes per `RESPONSE-CONVENTIONS.md` (NFR-013).

**Commit:** `feat(wallet-ledger): expose the withdrawal API`

---

## Phase 6 — Notification + clients

- `account-profile`: register `wallet.withdrawal.*` → `withdrawal_outcome` inbox row. **This is the last unproduced FR-016 trigger** — closes it together with W3.
- Web: replace the honest "unavailable" panel in `/{locale}/wallet/withdrawal` with the real flow; keep the honest state behind a config flag until Phase 7 passes.
- Mobile: there is **no** withdrawal screen today (SRS Appendix D S11 `—`). Either build it or record it as a web-only operator-adjacent flow in the SRS — decide explicitly.
- Wallet history (`/wallet/history`) must render withdrawal postings with the trace id (FR-010/FR-020 evidence, US-W3).

**Commit(s):** `feat(account-profile): notify withdrawal outcomes` , `feat(web): teacher withdrawal flow`

---

## Phase 7 — Acceptance

- Replay the payout callback (AC-008) and the older-than-state callback (AC-009) against a real Postgres.
- Reconcile one request end to end: wallet → request → ledger postings → history row → trace id.
- SRS: FR-014 status → implemented; Appendix C.3 "no WithdrawalRequest endpoint is claimed" removed; S11 note rewritten; AC-008/013/014 marked verified.

**Commit:** `docs(srs): close the withdrawal gap`

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| **A developer implements withdrawal anyway** because the phases are written down | **High** — this is the real risk now | The wave status says *deferred*; the SRS says FR-014 is out of MVP; the phase text is explicitly labelled a design record |
| **FR-014 silently stays a "Must" that nobody builds** | **High** — it is exactly today's state | The SRS amendment is the deliverable; W9 ✅27 forbids silent `Must` gaps |
| When a rail exists, limits get invented under time pressure | **High** | The doc records that **limits were never decided** — only the fee ("none") was |
| Withdrawal returns without an auth control | Medium | Precondition recorded: a rail **and** an auth control, or admin approval |
| "Temporarily unavailable" copy implies a fix is imminent | Medium | Copy changes to "not offered in this release" |

## Human decisions — **all closed 2026-10-25**

| Decision | Owner | Outcome |
|---|---|---|
| C1 — OQ-005 limits/fees/SLA/eligibility | **Product Owner + Finance** | **No fee.** Limits/SLA never decided — moot this release, owed at return |
| C2 — OQ-011 payout rail | **Engineering + Finance** | **No rail — wait for a real payout API.** FR-014 deferred |
| C3 — configurable, snapshotted exchange rate (BR-027) | Engineering + Finance | Still a real gap; now a **top-up-only** fix, tracked under W9 |
| C5 — pending never withdrawable (BR-038) | Product Owner + Engineering | Moot — `/wallet` already separates them |
| C6 — step-up vs. admin approval | **Product Owner** | **MFA removed** (W9); payouts do not ship |
| C7 — manual fulfilment still satisfies BR-069 | Product Owner + Finance | Moot — manual fulfilment not adopted |
| C8 — mobile parity | Product Owner | S11 not offered in this release |

## Definition of done

- FR-014 is recorded in the SRS as **deferred with a reason** (no payout rail), not left looking implemented.
- AC-008 / AC-013 / AC-014 are marked deferred alongside it.
- No withdrawal code, no fake payout status, and no "temporarily unavailable" copy implying it is coming in this release.
- When a payout API exists: re-open OQ-005 (limits are **not** inferred — the fee decision is "none", but the limits were never set) and require an auth control.
