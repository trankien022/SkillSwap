---
title: FR completion master plan — remaining, deferred and misbehaving requirements
type: plan
date: 2026-10-24
topic: fr-completion-master
status: Proposed
owner: Group 4
---

# FR completion master plan

**Status:** Proposed — no code written yet.

**Scope:** every FR in `docs/plans/SkillSwap-SRS.md` §3.2.1 that is **not implemented, only partially implemented, deferred, or implemented but behaves wrongly**. Confirmed and working FRs are listed once in §2 for the record and are not planned again.

**Companion plans** (one per module / group of function):

| # | Plan | FRs | Priority |
|---|---|---|---|
| W1 | [`2026-10-24-w1-booking-integrity-plan.md`](2026-10-24-w1-booking-integrity-plan.md) | FR-007, FR-009, FR-020 | P0 |
| W2 | [`2026-10-24-w2-outbox-reliability-plan.md`](2026-10-24-w2-outbox-reliability-plan.md) | FR-008/009/016/018/019 (all eventing) | P0 |
| W3 | [`2026-10-24-w3-notification-class-reminder-plan.md`](2026-10-24-w3-notification-class-reminder-plan.md) | FR-016 | P1 |
| W4 | [`2026-10-24-w4-audit-actor-attribution-plan.md`](2026-10-24-w4-audit-actor-attribution-plan.md) | FR-015 | P1 |
| W5 | [`2026-10-24-w5-in-class-chat-plan.md`](2026-10-24-w5-in-class-chat-plan.md) | FR-012 | P2 (gates closed 2026-10-25 — chat ships, contact info blocked) |
| W6 | [`2026-10-24-w6-admin-dashboard-completion-plan.md`](2026-10-24-w6-admin-dashboard-completion-plan.md) | FR-015, AC-031 | P2 (dispute half removed; account-lock half decided — OQ-015) |
| W7 | [`2026-10-24-w7-teacher-withdrawal-plan.md`](2026-10-24-w7-teacher-withdrawal-plan.md) | FR-014, AC-008, AC-013, AC-014, UC-005 | Out of the MVP — docs obligation only |
| W8 | [`2026-10-24-w8-jitsi-runtime-acceptance-plan.md`](2026-10-24-w8-jitsi-runtime-acceptance-plan.md) | FR-011, DEP-002 | P1 |
| W9 | [`2026-10-24-w9-residual-risks-plan.md`](2026-10-24-w9-residual-risks-plan.md) | FR-006, FR-013 (OQ-004), NFR-009/010, NFR-003/006 | P2 |

---

## 0. Gating rule — read before touching any wave

**Every wave starts with a Phase 0 "conflict resolution gate", and that gate is mandatory.** It lists, row by row, every place where the intended work is in tension with a **business rule** (`BR-nnn`), a **confirmed constraint** (`C-nnn`), a **resolved Open Question**, or an **unresolved Open Question**, and names the human who must decide it.

Non-negotiable properties of the gate:

1. **A developer may not close a gate row.** The decision is recorded in the **SRS/BRD or an ADR**, not in a commit message, a code comment, or a chat. The agent or developer may *prepare* options and *recommend* one; it may not *decide*.
2. **No code in a blocked phase before its row is closed.** Each phase heading names the rows that must be closed first (`after C1`, `requires C2`, …). If a row is open, the phase does not start — it does not start "provisionally".
3. **A blocked row may legitimately resolve to "out of scope".** Several rows will close with an SRS amendment rather than code. That is a successful outcome, not a failed plan.
4. **Already-resolved questions are listed per wave and must not be reopened.** Changing one is a new OQ/ADR, not a code decision.
5. **Open Question numbering is not free-form.** The BRD defines OQ-001…OQ-013 and **OQ-013 is already taken** (verifier expertise → ADR-027). New questions are **OQ-014** and beyond. The first one minted is **OQ-015** (account-lock scope); **OQ-014 is deliberately skipped** because its subject (disputes) was removed from the MVP.
6. **A product decision is not a closed gate until it is written into the SRS/ADR.** Appendix A records the Product Owner's answers of 2026-10-25; the per-wave gate commits remain owed, and no phase may claim a gate is closed while the SRS still says otherwise.

### 0.1 Cross-wave decision index

| Decision | Wave(s) | Owner | If unanswered |
|---|---|---|---|
| May an unverified account book a class? (BR-001 vs. US-T1/UC-003) | W1 C1/C2 | **Product Owner + BA** | **CLOSED 2026-10-25: NO** — SRS amended, AC-034 created; W1 Phase 3 implements it |
| When may a Teacher end a class? (BR-043/OQ-006 vs. `teacher_ended`) | W1 C3 | **Product Owner** (ADR-021 amendment) | **CLOSED 2026-10-25: never** — `teacher_ended` is removed; the room closing completes the class (AC-035). Early exit on an empty room: **C3a/C3b closed** — all participants gone, 5-min grace, only after `starts_at`, fed by a Jitsi webhook |
| Is at-least-once delivery enough? | W2 C1 | Engineering + PO | **OPEN** — default: no ordering guards, order-tolerant consumers |
| What is retryable vs. non-retryable? | W2 C2 | Engineering (ADR-013) | **OPEN** — default: only schema-validation failures are terminal |
| Who may replay a dead letter? | W2 C3 | PO + Admin | **OPEN** — default: admin-only, audited, single row |
| Reminder offset, eligibility, recipients | W3 C1–C4 | **Product Owner** | **CLOSED 2026-10-25** — one reminder at T−15min, both parties, Confirmed only |
| Where the audit actor travels | W4 C1/C2/C5 | Engineering + PO / BA | **CLOSED 2026-10-25** — on the command → event payload; ADR-035 |
| OQ-009 contact-sharing enforcement | W5 C1/C3/C5 | **Product Owner** | **CLOSED 2026-10-25** — chat ships, contact info **blocked** |
| Dispute + account-lock scope | W6 C1/C2/C4 | **Product Owner + BA** | **CLOSED 2026-10-25** — no disputes (FR-015 amended); admin-initiated suspension list, **OQ-015** |
| OQ-005 limits/fees, OQ-011 payout rail, NFR-009 step-up | W7 C1/C2/C6 | **Product Owner + Finance** | **CLOSED 2026-10-25** — no fee; no rail, so withdrawal is **out of the MVP** |
| Revoked Teacher vs. already-paid Learner | W8 C2 | **Product Owner** | **CLOSED 2026-10-25** — grandfather existing confirmed bookings, block new ones |
| Ranking in/out (OQ-004), MFA scope (NFR-009 is **Must**) | W9 C1–C3 | **Product Owner** | **CLOSED 2026-10-25** — ranking excluded; NFR-009 amended (no MFA) |

**Rule C3 of W9 applies programme-wide:** a `Must` requirement is either implemented or **explicitly amended** in the SRS. Nothing may sit silently unimplemented.

---

## 1. The work set, in one table

| Work item | FR | Kind of gap | Blocked by | Plan |
|---|---|---|---|---|
| Learner may book without a verified student status | FR-007 / US-M4 / AC-034 | **Misbehaves** — rule decided 2026-10-25; code not yet fixed | — (gate closed) | W1 Phase 3 |
| Double settlement on replay with a different settlement key | FR-009 / AC-004 / AC-005 | **Misbehaves** (latent) | — | W1 |
| A Teacher can complete a class that has not run yet; no expiry check on completion | FR-020 / AC-011, AC-035 | **Misbehaves** — capability removed 2026-10-25 (C3); early-exit-on-empty-room split out | — (C3, C3a, C3b all closed) | W1 Phase 1 / 1b |
| A pending booking that expired stays bookable/confirmable until the sweeper runs | FR-007 / AC-026 | **Misbehaves** (narrow race) | — | W1 |
| Outbox rows stranded `DEAD` on unclassified publish errors; no dead-letter replay | cross-cutting | **Misbehaves** | — (3 engineering calls recorded, not product-blocked) | W2 |
| Consumer double-delivery window (processed-event store is not in the same tx as the effect) | cross-cutting | Latent risk | — | W2 |
| "Class starting soon" notification has copy and a DB enum but **no producer** | FR-016 | **Not implemented** | — (gates closed) | W3 |
| `withdrawal_outcome` notification type is declared but nothing emits it | FR-016 | **Not implemented** (couples to W7) | — (withdrawal is out of MVP) | W3 (copy only) |
| Audit `actorId` is always `null`; the actor filter matches nothing | FR-015 / AC-032 | **Partially implemented** | ADR-035 first | W4 |
| Account-lock list missing from the operations dashboard | FR-015 / AC-031 | **Deferred** | OQ-015 only | W6 |
| ~~Dispute list missing from the operations dashboard~~ | FR-015 / AC-031 | **Removed from the MVP** 2026-10-25 — no dispute exists; BR-048 manual adjustment covers the cases | — | W6 (SRS amendment) |
| No in-platform chat (`Message` exists only in the data dictionary) | FR-012 / US-L2 | **Not implemented** | — (gates closed; ships) | W5 |
| No withdrawal endpoint, no hold/payout ledger flow, S11 is an honest "unavailable" page | FR-014 / UC-005 / AC-008, 013, 014 | **Out of the MVP** 2026-10-25 — no payout rail; SRS amendment is the deliverable | Awaiting a provider payout API | W7 (docs only) |
| Jitsi runtime never accepted; DEP-002 open | FR-011 / AC-006 | **Unverified** | — (self-hosted confirmed) | W8 |
| Search ranking / down-ranking thresholds unimplemented | FR-006, SR-BR-009 | **Out of the MVP** 2026-10-25 — excluded, filtered list stays | — | W9 (SRS amendment) |
| MFA for admin/verifier and step-up auth for payouts | NFR-009 | **Amended away** 2026-10-25 — no MFA this release, reason recorded | — | W9 (SRS amendment) |
| Jitsi failure UX degrades to a bare error, no retry guidance | NFR-006 | **Poor** | — | W9 (verify, likely already landed in W8) |

## 2. Confirmed and working — no work planned

FR-001, FR-002, FR-003, FR-004, FR-005, FR-008 (top-up), FR-010, FR-013 (core), FR-017, FR-018, FR-019.

These are not "finished forever"; they are simply not in this programme. Any defect found there becomes its own fix, not a phase here.

## 3. Sequencing and dependency graph

```
Wave 0 (unblocked work; each still passes its own Phase 0 gate first)
  W1 Booking integrity  ──┐   ALL GATES CLOSED 2026-10-25
  W2 Outbox reliability ──┴──> must land before W3/W4 rely on events (3 engineering calls open)
  W8 Jitsi acceptance   ──> independent, needs a second human + device (gates closed)

Wave 1 (after W2)
  W3 Notification reminder          gates closed 2026-10-25
  W4 Audit actor attribution        gate closed 2026-10-25 (ADR-035 — write it first)

Wave 2 (product gates)
  W5 Chat            gates closed 2026-10-25 — proceed
  W6 Dashboard       gates closed 2026-10-25 — dispute half removed; OQ-015 + ADR-036
  W9 Residual        gates closed 2026-10-25 — ranking out, NFR-009 amended

Wave 3 (finance gate)
  W7 Withdrawal      OUT OF THE MVP — docs obligation only
```

Rationale for the order:

- **W1 first** because two of its items are correctness defects on money (FR-009 replay, FR-020 completion) and one is a missing access gate (FR-007 verified-student). A demo can be wrong here silently.
- **W2 second** because W3 and W4 both ride on events. Fixing event delivery after adding producers would mean debugging two things at once.
- **W8 runs in parallel** but is calendar-bound (needs a real deployment and a second participant), so starting it early is free.
- **W5/W6/W9 were previously gated on Product Owner answers** — all now answered (Appendix A). Writing their specs before the answers arrived would have produced another ADR-034 §8/§9 ("deliberately deferred") — the exact failure this plan exists to stop.
- **W7 is no longer sequenced at all.** Withdrawal has no payout rail and the PO chose to wait for one, so the wave is a documentation obligation, not work.

## 4. Per-wave definition of done

Every wave inherits the repo Definition of Done (`AGENTS.md`), plus:

1. **Plan first.** Each companion plan lands its phases as separate commits (`docs` → `feat`/`fix` per phase). No phase is "the whole wave in one commit".
2. **Gate first.** The wave's Phase 0 gate is closed by a named human in the SRS/ADR before any blocked phase starts. The gate's own commit is the first commit of the wave, and it is a `docs` commit.
3. `pnpm verify` green, `pnpm test:arch` green, `--max-warnings=0`.
4. **ADR when a boundary moves.** W4, W5, W6 each require an ADR before code (ADR-035/036/037). W1/W2/W3/W8 are behaviour fixes inside existing boundaries and need none, but W2 changes `shared/messaging`, so it records its decision in the existing ADR-013 as an amendment; W1 amends ADR-021 and ADR-019; W8 amends ADR-020 and OQ-008. **W7 and W9 write no code** — their deliverable is an SRS amendment.
5. **SRS honesty.** When a wave closes a "Honest gap" (§2.3) or an AC caveat, the SRS row changes in the same PR. The SRS must never describe a state older than the code.
6. **Test evidence, not claims.** Each wave names its tests in the plan and must show them failing before the fix (or state explicitly why that was not possible).
7. **No new money path without an integer/invariant test.** Any wave touching credits adds or extends a property-style test asserting `teacher + fee == price` and non-negative balances.
8. **No invented business rule.** If a phase cannot be implemented without choosing a number, a threshold, a window or a policy that no confirmed requirement states, the phase stops and the gate row is reopened.
9. **No silent `Must` gap** (adopted 2026-10-25). Every `Must` FR/NFR is implemented or explicitly amended in the SRS with a stated reason. FR-014 and NFR-009 are the two current cases.

## 5. What this programme deliberately does not do

- **No dispute model.** FR-015's dispute clause is **removed** (decision 2026-10-25) and `disputed` leaves the state machine and data dictionary. No placeholder tables. The real cases go through BR-048's manual ledger adjustment.
- **No chat without the contact-sharing policy.** Decided: chat ships and contact sharing is **blocked**. The ADR must state the **RISK-009 bypass risk as accepted**, not solved.
- **No learner eligibility gate without a Product Owner answer.** Resolved 2026-10-25: an unverified account may not book (AC-034). W1 Phase 3 implements it; it is no longer an open question.
- **No "sensible default" for a number a requirement never gave.** Reminder offset (**decided: 15 min**), withdrawal limits (**never decided — the wave is out of scope**), ranking threshold (**excluded — never decided**) are decisions, not defaults.
- **No withdrawal at all in this release.** Decided 2026-10-25: no payout rail, no fee, and no fake payout status. FR-014 and AC-008/013/014 become **deferred with a reason**.
- **No ranking.** SR-BR-009 is **excluded from the MVP**; the filtered list stays.
- **No MFA.** NFR-009 is **amended**; the precondition for withdrawal's return is an auth control.
- **No E2E rewrite.** Wave testing targets the existing jest/vitest suites; Playwright/device evidence is limited to W8 and the manual rubric in `tasks/todo.md`.
- **No renumbering of requirement IDs** (AGENTS.md). New ids mint forward: **OQ-015** only.

## 6. Tracking

| Wave | Plan file | Gate commit (must land first) | Then |
|---|---|---|---|
| W1 | `2026-10-24-w1-booking-integrity-plan.md` | `docs(srs): resolve booking eligibility and completion-window conflicts` | `test` → `fix` |
| W2 | `2026-10-24-w2-outbox-reliability-plan.md` | `docs(adr): amend ADR-013 …` | `test` → `fix` |
| W3 | `2026-10-24-w3-notification-class-reminder-plan.md` | `docs(srs): pin the class reminder offset, recipients and eligibility` | `feat` |
| W4 | `2026-10-24-w4-audit-actor-attribution-plan.md` | `docs(adr): decide audit actor attribution` | `feat` |
| W5 | `2026-10-24-w5-in-class-chat-plan.md` | `docs(adr): decide in-class chat scope and enforcement` — gates closed | `feat` |
| W6 | `2026-10-24-w6-admin-dashboard-completion-plan.md` | `docs(srs): drop the dispute clause; mint OQ-015 for account locks` | `docs(adr)` → `feat` |
| W7 | `2026-10-24-w7-teacher-withdrawal-plan.md` | `docs(srs): defer teacher withdrawal out of the MVP (no payout rail)` | `docs` only |
| W8 | `2026-10-24-w8-jitsi-runtime-acceptance-plan.md` | `docs(adr): close DEP-002 and grandfather confirmed bookings on revocation` | `docs(runbook)` → evidence |
| W9 | `2026-10-24-w9-residual-risks-plan.md` | `docs(srs): exclude ranking, amend NFR-009, adopt the no-silent-Must rule` | `docs` only |

## 7. Status of this document set

| Doc | State |
|---|---|
| FR audit (§1) | Complete |
| Nine companion plans | Complete, each with a Phase 0 conflict gate |
| Gates closed by a human | **All product gates closed 2026-10-25** (Appendix A). Open: **three engineering calls in W2** (D10a–c) and **D12/OQ-010** (pilot scope — no code depends on it) |
| Code written | **None** |

Until a gate row is closed in the SRS/ADR by its **named owner**, the corresponding wave has not started, regardless of how many phases are written down. A developer may close an **engineering** row; only the Product Owner may close a **product** row.

---

## Appendix A — Consolidated decision register

Every open question and ambiguity across all nine waves, in one place, so they can be resolved in a single sitting instead of wave by wave. **D1–D12 are product/business decisions only the Product Owner (with Finance/BA where noted) may make.** **E1–E8 are engineering calls** recorded here for transparency — they are not blocking and need no PO answer, but a PO may override any of them.

### A.0 Already decided — do not re-ask

| # | Question | Answer | Recorded in |
|---|---|---|---|
| ✅ 1 | May an unverified account book? | **No.** Browse stays open; booking is refused (`learner_not_verified`). | SRS §2.3, UC-003, FR-007, **AC-034**; W1 C1/C2 |
| ✅ 2 | May a Teacher end a class themselves? | **No.** `teacher_ended` is removed from the domain. The room closing completes the class. | **AC-035**, ADR-021 Amendment A, OQ-006 amendment; W1 C3 |
| ✅ 3 | Can the class be open outside start→end? | **No.** Room window is `starts_at − openMinutes` → `starts_at + duration`. | `room-access.ts:63-72` (already enforced) |
| ✅ 4 | **D1b** — who must be absent for early completion? | **All participants left.** A Teacher leaving while learners remain does **not** end the class. | Decided 2026-10-25 |
| ✅ 5 | **D1c** — grace period | **5 minutes** empty after `starts_at`, then complete. | Decided 2026-10-25 |
| ✅ 6 | **D1a** — when may the idle rule fire? | **Only from `starts_at`**, never before. | Decided 2026-10-25 (implied by C3; required for correctness) |
| ✅ 7 | **D2** — presence signal | **Jitsi webhook** (`participant-joined`/`participant-left`) → new inbound endpoint. Also closes AC-024's teacher-no-show trust gap. | Decided 2026-10-25 |
| ✅ 8 | **D3** — class reminder | **One** reminder at `starts_at − openMinutes` (**15 min**), to **both** parties, **Confirmed** bookings of Published/Full classes only. A stale reminder after a cancellation is **accepted**; no retraction. | Decided 2026-10-25 |
| ✅ 9 | **D4a** — is chat in the MVP? | **Yes.** Chat ships, with contact sharing **blocked**. | Decided 2026-10-25 |
| ✅ 10 | **D4b** (OQ-009) — on detected contact info | **Block.** Message rejected, nothing stored. *(Deviation from the BRD's "warn + log" recommendation — see A.1 D4 note: blocking needs no moderation queue.)* | Decided 2026-10-25 |
| ✅ 11 | **D4c/D4d** — chat window and retention | **Same window as room access**; **keep messages**, no deletion in MVP. | Decided 2026-10-25 (follows from D4a + OQ-008 precedent) |
| ✅ 12 | **D4e** — off-platform bypass (RISK-009) | **Accepted and recorded**, not solved. | Decided 2026-10-25 |
| ✅ 13 | **D5a** — how the actor travels | **On the command** → event payload. `AsyncLocalStorage` rejected. | Decided 2026-10-25 |
| ✅ 14 | **D5b/D5c/D5d** | System events use a `SYSTEM_ACTOR_ID` constant; **no backfill**; recorded in **ADR-035**, no new OQ (OQ-013 is taken). | Decided 2026-10-25 |
| ✅ 15 | **D6b — what is a dispute?** | **None. No dispute workflow in the MVP.** FR-015's dispute list is **amended** to drop it. The three real cases (wrong content, no-show that slipped through, post-completion money disagreement) are handled by the existing manual **BR-048** ledger adjustment, not by a new state. | Decided 2026-10-25 |
| ✅ 16 | **D6a** — account-lock list vs. C-010 | **Admin-initiated suspension list**; reuse the existing `Suspended` status + reason + audit row. Nothing automatic. | Decided 2026-10-25 |
| ✅ 17 | **D6c** — is `disputed` a booking state? | **No** — it is removed from the SRS state machine and the data dictionary, because no dispute exists (✅15). | Follows from ✅15 |
| ✅ 18 | **D6d** — new OQ ids | **OQ-015 (account lock scope)** only. **OQ-014 is NOT used for disputes** (no dispute exists). | Follows from ✅15 |
| ✅ 19 | **D7b (OQ-011)** — payout rail | **Wait for a real provider payout API.** Withdrawal is **not shipped in the MVP**. No manual-fulfilment mode, no fake paid status. | Decided 2026-10-25 |
| ✅ 20 | **D7a (OQ-005)** — withdrawal fee | **No withdrawal fee.** The 10% commission on each sale is the platform's only cut; a payout-time fee would charge twice. | Decided 2026-10-25 |
| ✅ 21 | **D7c** — configurable exchange rate | Still required by **BR-027** (`VND_PER_CREDIT = 1000` is hardcoded at `wallet.ts:4`). Becomes a **top-up-only** concern now that withdrawal is out of the MVP; move it to config and snapshot per request. | Decided 2026-10-25 |
| ✅ 22 | **D7d** — step-up for payouts | Moot for the MVP: withdrawal is out (✅19) and MFA is amended (✅24). When withdrawal returns, it needs **both** a rail and an auth control. | Decided 2026-10-25 |
| ✅ 23 | **D8a (OQ-004)** — search ranking | **Excluded from the MVP.** Filtered list stays; down-ranking is recorded as excluded in the SRS, final. | Decided 2026-10-25 |
| ✅ 24 | **D8b (NFR-009)** — MFA | **No MFA. NFR-009 is amended** to remove the MFA/step-up requirement, with the reason recorded. | Decided 2026-10-25 |
| ✅ 25 | **D9b** — revoked Teacher vs. paid Learner | **Honour existing confirmed bookings.** A learner who already paid keeps the class; **new** bookings on that teacher are blocked. Implements the commitment lock (BR-016); no refund needed. | Decided 2026-10-25 |
| ✅ 26 | **D9a (DEP-002)** | **Self-hosted Jitsi** (already ADR-020's choice — now confirmed, not pending). | Decided 2026-10-25 |
| ✅ 27 | **D11** — `Must` requirement policy | A `Must` is implemented **or** explicitly amended in the SRS. Never silently skipped. | Decided 2026-10-25 |

> **What these answers do to the programme:** W7 (withdrawal) leaves the MVP entirely; W5 (chat) proceeds; W6 shrinks to the account-lock half only. The P0 wave W1 is now **fully unblocked** — every one of its gates is closed.

### A.1 Residual notes on the decided items

- **D4 (chat, enforcement).** The BRD's OQ-009 recommendation was "warn + log", but warning requires an admin moderation queue, and **C-010** says the MVP has no moderation system. Blocking therefore satisfies BR-056 ("không cho phép") without creating an unscoped queue. This deviation is recorded here deliberately, not silently. **The SRS still says OQ-009 is unresolved** — amending that row is W5's first commit.
- **D7 (withdrawal).** FR-014 and AC-008/013/014 are `Must` and now **out of MVP scope by decision**. That is exactly the case ✅27 governs: the SRS must state the exclusion and its reason, not leave the requirement looking implemented.
- **D8 (MFA).** NFR-009 is another `Must` amendment under ✅27. The reason recorded is: no MFA implementation exists, and the only feature that required step-up (payout) is out of scope.
- **D6 (dispute).** Removing `disputed` touches three artefacts: the SRS state machine (`Completed --> Disputed`), the data dictionary row, and `uq_bookings_active_learner_class`'s covered states. All three change in one docs commit.
- **D1/D2 (empty room).** Without D1a ("only from `starts_at`") every published class is empty at publish and would complete instantly. That guard is not optional and is written into AC-035's idle rule.
- **D3 (reminder).** The reminder offset reuses `DEFAULT_OPEN_MINUTES` so a reminder and a working door coincide; if the two ever diverge, the reminder must follow the door, not the other way round.

### A.2 Remaining open items

| # | Question | Owner | Status |
|---|---|---|---|
| D10a | W2 C1 — ordering: is at-least-once enough? | Engineering | **Open** (recommended: declare no ordering, require order-tolerant consumers) |
| D10b | W2 C2 — what is non-retryable? | Engineering | **Open** (recommended: only schema-validation failures) |
| D10c | W2 C3 — who may replay a dead letter? | Engineering + Admin | **Open** (recommended: admin, audited, single row) |
| E1–E8 | The engineering calls in Appendix A.4 | Engineering | **Recorded defaults** — implement them unless overridden |
| D12 | OQ-010 — pilot scope and success-metric targets | Product Owner | **Open**; no code depends on it, but it defines the demo's "done" |
| D13 | C-009 / SR-BR-008 — chat contact-sharing enforced by **blocking** | Product Owner | **CLOSED 2026-10-25** — `block` is the approved policy. Recorded in SRS C-009, SR-BR-008 and OQ-009; no further confirmation needed |

The three D10 rows are engineering calls with recorded defaults; they do not need a product answer, but a PO may override them. **They are the only items blocking W2**, and W2 should not wait on a product meeting.

### A.3 What each remaining item unblocks

| Item | Unlocks |
|---|---|
| **D10a–c** | W2 Phases 2/3/5 (last P0 wave still gated) |
| **D13** | Nothing — closed | It only ever gated the SRS wording, which is now updated |
| **D12** | Nothing in code; only how the demo is judged |

Everything else is unblocked. The P0 path is: **W1 → W2 (after D10) → W3/W4**.

### A.4 Open engineering calls (not blocking)

| # | Wave | Question | Recorded default |
|---|---|---|---|
| E1 | W1 | Is a booking-settlement timeout a failure? | **No** — hold is retained (BR-033) |
| E2 | W1 | Does an expired hold free the seat before the sweeper runs? | **Yes** — expiry *is* the cancellation; the sweeper only persists it |
| E3 | W2 | `next_attempt_at` column, or attempt-count only? | `next_attempt_at` (6 migrations, one per schema) |
| E4 | W2 | `DEAD` row retention | Keep forever in MVP |
| E5 | W3 | Where does the reminder collector live? | `live-class` (owns classes/bookings); the `schedule` module stays empty |
| E6 | W5 | Which module owns chat messages? | `live-class` |
| E7 | W8 | Does the room close when a class completes? | **Yes** — booking stops being joinable |
| E8 | W4 | Deploy order for a required payload field | Emitters first, consumer strictness second |
| E9 | W1 | Which `class_presence` rows exist before Jitsi is wired? | **None** — an empty table means "unknown", and unknown never completes a class early |
