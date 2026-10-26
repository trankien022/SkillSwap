---
title: W9 — Residual risks: ranking, MFA, failure UX
type: plan
date: 2026-10-24
topic: w9-residual-risks
status: Phases 0–5 done (2026-10-26) — ranking excluded, MFA amended, trace walkthrough written, failure UX verified, accessibility rubric written
owner: Group 4
---

# W9 — Residual risks

**Parent:** [`2026-10-24-fr-completion-master-plan.md`](2026-10-24-fr-completion-master-plan.md)
**FRs/NFRs:** FR-006 (ranking), FR-013 (threshold), NFR-003, NFR-006, NFR-007, NFR-009, NFR-010
**Priority:** P2 · **Unblocked 2026-10-25** — two exclusions and one rule adoption, no code.

This wave collects the things that are neither missing features nor hard defects, but that the SRS still hedges on. Each item is scoped small on purpose so it can be dropped without leaving a hole.

---

## R1 — Search ranking and down-ranking (FR-006, SR-BR-009) — **OUT of MVP (decided 2026-10-25)**

**State:** FR-006 is implemented as a bounded, cursor-paginated list with filters. What does not exist: ranking, and SR-BR-009's "low-quality profiles are down-ranked per approved threshold, never deleted".

**Decision (2026-10-25):** ranking is **excluded from the MVP**. OQ-004 (threshold, minimum review count, recovery) stays unanswered, and a filtered list is a defensible product; inventing a threshold would be the ADR-034 §8 failure mode.

**Work owed:** an SRS amendment only — SR-BR-009 is marked **excluded from the MVP** with that reason, and FR-006's "search granularity open" note is closed as excluded. **No code.**

---

## R2 — Admin/Verifier MFA and payout step-up (NFR-009) — **AMENDED away (decided 2026-10-25)**

**State:** NFR-009 requires MFA for Administrator/Verifier and step-up authentication for payouts and payout-destination changes. `account-profile` has password + session only. No TOTP, no step-up.

AC-033 covers authorization (403), not authentication strength, so this was a genuine unaddressed `Must` NFR.

**Decision (2026-10-25):** **no MFA in the MVP.** NFR-009 is **amended** to remove the MFA/step-up requirement with the reason recorded: no implementation exists, and the only feature that required step-up (teacher payout) is itself out of MVP scope (W7). Withdrawal returning later is a **precondition** on having an auth control — recorded in W7.

**Work owed:** the NFR-009 amendment + ADR note. **No TOTP code.**

---

## R3 — Jitsi/gateway failure UX (NFR-006)

**State:** covered structurally by W8 Phase 4. Kept here as a cross-reference so it is not lost if W8 is descoped.

**Verified 2026-10-26** (`16f77ba`). Checked rather than assumed: the embed error had the right sentence and **no action**, so NFR-006's "actionable" clause was not met. The retry now re-enters the connecting phase with the access it already holds, so a transient Jitsi failure costs no extra room-access request. Verified against a genuinely failing embed in the browser, in both locales.

---

## R4 — End-to-end trace (NFR-003, NFR-005)

**State:** SRS §3.6 asks to "trace one sample transaction through gateway → API → ledger". Top-up carries a trace id; the audit log carries `traceId`. There is no *single documented walkthrough* proving they join.

**Sketch, small:** write `docs/runbooks/transaction-trace.md` with one real top-up + one settlement traced by id across tables, plus a scripted assertion (or a test) that the ids match. No code change expected; if the ids do **not** join, that itself is the finding and becomes a fix.

**Done 2026-10-26.** The runbook was written from a real top-up on the local stack, and the ids did **not** join: a settled top-up wrote its ledger row and moved the balance but emitted **no** outbox event, so `account-profile.notification-wallet-completed` (FR-016's "completed wallet transactions") never fired. Fixed in `83f3bd5` — `applyTopUp` now writes ledger → balance → event in one transaction, pinned by 3 unit tests and 2 E2E tests. The same trace re-run after the fix closes end to end on one ledger id. Reversals, refunds and income releases still emit nothing; recorded as named gaps rather than invented contract members.

---

## R5 — Accessibility spot-check (NFR-007)

**State:** status is text + colour everywhere (verified by design rules), but keyboard traversal and screen-reader labels on the two newest surfaces (admin operations W6, chat W5) are not checked.

**Sketch:** extend the acceptance rubric in `tasks/mobile-week6-acceptance.md` with a keyboard-only pass and a screen-reader pass for those two screens, once they exist. No standalone work.

**Done 2026-10-26.** The rubric is in `tasks/mobile-week6-acceptance.md` (§ "Accessibility spot-check"), with the known gap recorded: the chat list deliberately has no `aria-live` region, so a sent message is not announced. It stays **unrun** until a human sits at a keyboard — that is the honest state, and it is the one item in W9 an agent cannot close.

---

## Phase 0 — Conflict resolution gate (**developer interference required**)

> **STOP (gate closed 2026-10-25).** All three policy items are decided: ranking **out**, MFA **out**, and the no-silent-`Must` rule **adopted**. Only documentation is owed.

| # | Conflict | Rules in tension | Decision owner | Blocking? | How it is closed |
|---|---|---|---|---|---|
| C1 | **Is ranking in MVP?** | FR-006 is implemented as a filtered list; SR-BR-009 says "down-ranked per approved threshold, never deleted", but **OQ-004 is unresolved** (threshold, minimum review count, recovery) | **Product Owner** | **CLOSED 2026-10-25 — excluded from the MVP** | SR-BR-009 marked excluded with reason; FR-006's granularity note closed as excluded. Final, not deferred |
| C2 | **Is MFA in MVP?** | NFR-009 (**Must**): "Administrator/Verifier dùng MFA" + step-up for payouts vs. no TOTP exists and no ADR ever scoped it | **Product Owner** | **CLOSED 2026-10-25 — no MFA; NFR-009 amended** | Reason recorded: no implementation, and the only step-up consumer (payout) is out of MVP (W7) |
| C3 | **Does a `Must` requirement ever expire?** | NFR-009 is labelled Must and unimplemented; FR-014 (Must) is out of MVP by decision (W7) | Product Owner + BA | **CLOSED 2026-10-25 — never** | Rule adopted: a `Must` is implemented **or explicitly amended** in the SRS with a reason. No item may stay silently unimplemented |
| C4 | **Ranking vs. OQ-004 ownership** | ADR-034 §8 precedent: no business rule without an answer | Engineering | Closed | Moot — ranking is excluded, so no threshold is chosen |

**Already resolved — do not reopen:** OQ-010 (pilot scope, no code depends on it), ADR-034 §8 precedent, the C-010 no-moderation-system boundary.

**Exit criteria (met 2026-10-25):** C1–C3 recorded in the SRS/ADR; C4 moot.

**Commit:** `docs(srs): exclude ranking, amend NFR-009, adopt the no-silent-Must rule (W9 phase 0)`

---

## Phase order

| Phase | Item | Blocked? |
|---|---|---|
| 0 | Close C1–C3 (ranking out, MFA out + amend NFR-009, no-silent-Must rule) | **closed 2026-10-25** |
| 1 | SRS amendment: SR-BR-009 + FR-006 note marked excluded | no |
| 2 | SRS amendment: NFR-009 MFA/step-up removed with reason | no |
| 3 | R4 trace walkthrough | no — start anytime |
| 4 | R3 — verify NFR-006 failure UX actually landed in W8 Phase 4 | after W8 |
| 5 | R5 rubric additions | after W5/W6 |

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| **A developer implements ranking** because the filtered list "almost does it" | Medium | C1 records the exclusion as final; SR-BR-009 says excluded |
| **NFR-009 stays a `Must` NFR that nobody builds and nobody records** | **High** — it is exactly today's state | The amendment **is** the deliverable; C3 makes that mandatory |
| The amendment is read as "security is cancelled" rather than "this release" | Medium | The amendment states the release scope and the precondition for withdrawal's return |
| Trace walkthrough reveals ids that do not join | Medium | That is the finding — it becomes a fix, not a doc |
| Accessibility rubric added for screens that do not exist (W5/W6) | Medium | Phase 5 is last and depends on those waves landing |

## Human decisions required — **all closed 2026-10-25**

| Decision | Owner | Outcome |
|---|---|---|
| C1 — ranking in MVP or excluded (OQ-004) | **Product Owner** | **Excluded from the MVP** |
| C2 — MFA scope (NFR-009 is Must) | **Product Owner** | **No MFA; NFR-009 amended** |
| C3 — no `Must` requirement may stay silently unimplemented | Product Owner + BA | **Adopted programme-wide** |

## Definition of done

- Every "open" hedge in the SRS for these items is either closed by code or **explicitly excluded in the SRS** — no third state.
- No new business rule invented without an OQ answer (C1/C4).
- Every `Must` NFR in the touched set has a recorded disposition (C3).
